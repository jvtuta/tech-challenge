import { Controller, Inject, Logger } from '@nestjs/common';
import { Ctx, EventPattern, type KafkaContext, Payload } from '@nestjs/microservices';
import { TOPICS } from '@tech-challenge/contracts';
import { EVENT_PUBLISHER, type EventPublisher, parseEnvelope } from '@tech-challenge/messaging';
import { handleTransactionCreated } from '../application/handle-transaction-created';

/**
 * Borda Kafka do antifraude. Mensagem fora do contrato é descartada com log e o offset
 * avança; exceção do handler sobe, e o transporte do NestJS a trata como retriable: o offset
 * não é commitado e o broker reentrega a mensagem.
 */
@Controller()
export class TransactionCreatedController {
  private readonly logger = new Logger(TransactionCreatedController.name);
  private readonly handle: ReturnType<typeof handleTransactionCreated>;

  constructor(@Inject(EVENT_PUBLISHER) publisher: EventPublisher) {
    this.handle = handleTransactionCreated(publisher);
  }

  @EventPattern(TOPICS.TRANSACTION_CREATED)
  async onTransactionCreated(
    @Payload() payload: unknown,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    const envelope = parseEnvelope(payload);
    if (envelope?.eventType !== TOPICS.TRANSACTION_CREATED) {
      const message = context.getMessage();
      this.logger.warn(
        `Discarding message outside the event contract (key=${message.key?.toString()}, offset=${message.offset})`,
      );
      return;
    }
    await this.handle(envelope);
  }
}
