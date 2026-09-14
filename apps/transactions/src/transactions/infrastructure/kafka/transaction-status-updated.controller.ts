import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, type KafkaContext, Payload } from '@nestjs/microservices';
import { TOPICS, type TransactionStatusUpdatedData } from '@tech-challenge/contracts';
import { parseEnvelope } from '@tech-challenge/messaging';
import { DomainError } from '../../../shared/domain/domain-error';
import { TransactionNotFoundError } from '../../application/errors';
import { UpdateTransactionStatus } from '../../application/update-transaction-status.use-case';

const VISIBILITY_ATTEMPTS = 3;
const VISIBILITY_WAIT_MS = 250;

/**
 * Borda Kafka do serviço de transações. A categoria do erro decide o destino da mensagem:
 * fora do contrato ou erro de negócio determinístico (`invalid`, `not-found`) é descartado
 * com log, porque reprocessar daria o mesmo resultado e travaria a partição; qualquer outro
 * erro sobe, e o transporte reentrega a mensagem.
 */
@Controller()
export class TransactionStatusUpdatedController {
  private readonly logger = new Logger(TransactionStatusUpdatedController.name);

  constructor(private readonly updateStatus: UpdateTransactionStatus) {}

  @EventPattern(TOPICS.TRANSACTION_STATUS_UPDATED)
  async onStatusUpdated(@Payload() payload: unknown, @Ctx() context: KafkaContext): Promise<void> {
    const envelope = parseEnvelope(payload);
    if (envelope?.eventType !== TOPICS.TRANSACTION_STATUS_UPDATED) {
      const message = context.getMessage();
      this.logger.warn(
        `Discarding message outside the event contract (key=${message.key?.toString()}, offset=${message.offset})`,
      );
      return;
    }
    try {
      const changed = await this.applyOnceVisible(envelope.data);
      if (!changed) {
        this.logger.log(
          `Verdict already applied to ${envelope.data.transactionExternalId}; ignoring duplicate`,
        );
      }
    } catch (error) {
      if (
        error instanceof DomainError &&
        (error.kind === 'invalid' || error.kind === 'not-found')
      ) {
        this.logger.warn(
          `Discarding verdict for ${envelope.data.transactionExternalId}: ${error.message}`,
        );
        return;
      }
      throw error;
    }
  }

  /**
   * O veredito pode chegar antes de a gravação da transação ficar visível, porque o evento de
   * criação sai dentro da mesma transação do banco. Uma espera curta cobre essa janela sem
   * transformar uma transação realmente inexistente em mensagem envenenada.
   */
  private async applyOnceVisible(data: TransactionStatusUpdatedData): Promise<boolean> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.updateStatus.execute(data);
      } catch (error) {
        if (!(error instanceof TransactionNotFoundError) || attempt >= VISIBILITY_ATTEMPTS) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, VISIBILITY_WAIT_MS));
      }
    }
  }
}
