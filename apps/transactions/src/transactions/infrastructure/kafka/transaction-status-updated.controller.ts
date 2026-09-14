import { Controller, Logger, UseFilters } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { TOPICS, type TransactionStatusUpdatedEvent } from '@tech-challenge/contracts';
import { DiscardEventFilter } from '../../../shared/infrastructure/messaging/discard-event.filter';
import { EnvelopePipe } from '../../../shared/infrastructure/messaging/envelope.pipe';
import { UpdateTransactionStatus } from '../../application/update-transaction-status.use-case';
import { TransactionStatusStream } from '../sse/transaction-status-stream';

/** Borda Kafka do serviço de transações; o que fazer com cada erro é decisão do filter. */
@Controller()
@UseFilters(DiscardEventFilter)
export class TransactionStatusUpdatedController {
  private readonly logger = new Logger(TransactionStatusUpdatedController.name);

  constructor(
    private readonly updateStatus: UpdateTransactionStatus,
    private readonly stream: TransactionStatusStream,
  ) {}

  @EventPattern(TOPICS.TRANSACTION_STATUS_UPDATED)
  async onStatusUpdated(
    @Payload(EnvelopePipe.of(TOPICS.TRANSACTION_STATUS_UPDATED))
    event: TransactionStatusUpdatedEvent,
  ): Promise<void> {
    const changed = await this.updateStatus.execute(event.data);
    if (changed) {
      this.stream.publish(event.data);
      return;
    }
    this.logger.log(
      `Verdict already applied to ${event.data.transactionExternalId}; ignoring duplicate`,
    );
  }
}
