import { Controller, Logger, UseFilters } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  TOPICS,
  type TransactionStatusUpdatedData,
  type TransactionStatusUpdatedEvent,
} from '@tech-challenge/contracts';
import { DiscardEventFilter } from '../../../shared/infrastructure/messaging/discard-event.filter';
import { EnvelopePipe } from '../../../shared/infrastructure/messaging/envelope.pipe';
import { TransactionNotFoundError } from '../../application/errors';
import { UpdateTransactionStatus } from '../../application/update-transaction-status.use-case';

const VISIBILITY_ATTEMPTS = 3;
const VISIBILITY_WAIT_MS = 250;

/** Borda Kafka do serviço de transações; o que fazer com cada erro é decisão do filter. */
@Controller()
@UseFilters(DiscardEventFilter)
export class TransactionStatusUpdatedController {
  private readonly logger = new Logger(TransactionStatusUpdatedController.name);

  constructor(private readonly updateStatus: UpdateTransactionStatus) {}

  @EventPattern(TOPICS.TRANSACTION_STATUS_UPDATED)
  async onStatusUpdated(
    @Payload(EnvelopePipe.of(TOPICS.TRANSACTION_STATUS_UPDATED))
    event: TransactionStatusUpdatedEvent,
  ): Promise<void> {
    const changed = await this.applyOnceVisible(event.data);
    if (!changed) {
      this.logger.log(
        `Verdict already applied to ${event.data.transactionExternalId}; ignoring duplicate`,
      );
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
