import { TOPICS, type TransactionCreatedEvent } from '@tech-challenge/contracts';
import { dispatch, type EventPublisher } from '@tech-challenge/messaging';
import { evaluateTransaction } from '../domain/evaluate-transaction';

/**
 * Reação ao `transaction.created`: avalia e publica o veredito com a mesma chave, para que
 * o serviço de transações receba os eventos de uma transação na ordem em que aconteceram.
 */
export function handleTransactionCreated(publisher: EventPublisher) {
  return async (event: TransactionCreatedEvent): Promise<void> => {
    const { transactionExternalId } = event.data;
    const status = evaluateTransaction(event.data);
    await dispatch(publisher)
      .event(TOPICS.TRANSACTION_STATUS_UPDATED)
      .keyedBy(transactionExternalId)
      .with({ transactionExternalId, status })
      .publish();
  };
}
