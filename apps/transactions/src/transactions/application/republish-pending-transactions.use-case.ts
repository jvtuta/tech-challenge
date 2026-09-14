import { Inject, Injectable, Logger } from '@nestjs/common';
import { EVENT_PUBLISHER, type EventPublisher } from '@tech-challenge/messaging';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepository,
} from '../domain/transaction.repository';
import { publishTransactionCreated } from './publish-transaction-created';

export const SWEEP_BATCH_SIZE = 100;

/**
 * Recupera transações cujo `transaction.created` não chegou ao broker (falha depois do commit)
 * ou cujo veredito se perdeu: republica o evento das que continuam pendentes depois do corte.
 * Um evento a mais é inócuo, porque o antifraude e o consumer de status são idempotentes.
 */
@Injectable()
export class RepublishPendingTransactions {
  private readonly logger = new Logger(RepublishPendingTransactions.name);

  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher,
  ) {}

  /** Devolve quantas transações tiveram o evento republicado. */
  async execute(cutoff: Date): Promise<number> {
    const pending = await this.transactions.findPendingOlderThan(cutoff, SWEEP_BATCH_SIZE);
    let republished = 0;
    for (const transaction of pending) {
      try {
        await publishTransactionCreated(this.publisher, transaction);
        republished += 1;
      } catch (error) {
        this.logger.warn(
          `Could not republish transaction.created for ${transaction.transactionExternalId}: ${String(error)}`,
        );
      }
    }
    return republished;
  }
}
