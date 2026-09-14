import { TOPICS, type TransactionCreatedEvent } from '@tech-challenge/contracts';
import { dispatch, type EventPublisher } from '@tech-challenge/messaging';
import type { Transaction } from '../domain/transaction';

/** Um único lugar monta o `transaction.created`: a criação e o varredor publicam o mesmo evento. */
export function publishTransactionCreated(
  publisher: EventPublisher,
  transaction: Transaction,
): Promise<TransactionCreatedEvent> {
  return dispatch(publisher)
    .event(TOPICS.TRANSACTION_CREATED)
    .keyedBy(transaction.transactionExternalId)
    .with({ transactionExternalId: transaction.transactionExternalId, value: transaction.value })
    .publish();
}
