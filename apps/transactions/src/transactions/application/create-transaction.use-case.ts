import { Inject, Injectable } from '@nestjs/common';
import { TOPICS } from '@tech-challenge/contracts';
import { dispatch, EVENT_PUBLISHER, type EventPublisher } from '@tech-challenge/messaging';
import { Transaction, type NewTransaction } from '../domain/transaction';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepository,
} from '../domain/transaction.repository';
import { EventPublishFailedError } from './errors';
import { UNIT_OF_WORK, type UnitOfWork } from './unit-of-work';

@Injectable()
export class CreateTransaction {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher,
  ) {}

  /**
   * Grava a transação pendente e publica `transaction.created` na mesma unidade de trabalho.
   * Se a publicação falhar, a gravação é desfeita: melhor recusar a criação do que deixar uma
   * transação pendente que o antifraude nunca vai avaliar.
   */
  async execute(input: NewTransaction): Promise<Transaction> {
    const transaction = Transaction.create(input);

    await this.unitOfWork.run(async (context) => {
      await this.transactions.save(transaction, context);
      try {
        await dispatch(this.publisher)
          .event(TOPICS.TRANSACTION_CREATED)
          .keyedBy(transaction.transactionExternalId)
          .with({
            transactionExternalId: transaction.transactionExternalId,
            value: transaction.value,
          })
          .publish();
      } catch (error) {
        throw new EventPublishFailedError(TOPICS.TRANSACTION_CREATED, error);
      }
    });

    return transaction;
  }
}
