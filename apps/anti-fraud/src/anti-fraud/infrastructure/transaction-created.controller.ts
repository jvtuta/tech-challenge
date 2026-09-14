import { Controller, Inject, UseFilters } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { TOPICS, type TransactionCreatedEvent } from '@tech-challenge/contracts';
import { EVENT_PUBLISHER, type EventPublisher } from '@tech-challenge/messaging';
import { DiscardEventFilter } from '../../shared/infrastructure/messaging/discard-event.filter';
import { EnvelopePipe } from '../../shared/infrastructure/messaging/envelope.pipe';
import { handleTransactionCreated } from '../application/handle-transaction-created';

/** Borda Kafka do antifraude; o que fazer com cada erro é decisão do filter. */
@Controller()
@UseFilters(DiscardEventFilter)
export class TransactionCreatedController {
  private readonly handle: ReturnType<typeof handleTransactionCreated>;

  constructor(@Inject(EVENT_PUBLISHER) publisher: EventPublisher) {
    this.handle = handleTransactionCreated(publisher);
  }

  @EventPattern(TOPICS.TRANSACTION_CREATED)
  async onTransactionCreated(
    @Payload(EnvelopePipe.of(TOPICS.TRANSACTION_CREATED)) event: TransactionCreatedEvent,
  ): Promise<void> {
    await this.handle(event);
  }
}
