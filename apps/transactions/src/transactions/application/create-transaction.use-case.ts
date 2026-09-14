import { Inject, Injectable, Logger } from '@nestjs/common';
import { EVENT_PUBLISHER, type EventPublisher } from '@tech-challenge/messaging';
import { UNIT_OF_WORK, type UnitOfWork } from '../../shared/application/unit-of-work';
import { Transaction, type NewTransaction } from '../domain/transaction';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepository,
} from '../domain/transaction.repository';
import { publishTransactionCreated } from './publish-transaction-created';

@Injectable()
export class CreateTransaction {
  private readonly logger = new Logger(CreateTransaction.name);

  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisher,
  ) {}

  /**
   * Grava a transação pendente e só então publica `transaction.created`, fora da transação do
   * banco: o broker nunca segura uma conexão do pool e o evento nunca sai antes da linha
   * existir. Se a publicação falhar, a transação continua válida e o varredor de pendentes
   * republica o evento; por isso a falha vira aviso, não erro para o cliente.
   */
  async execute(input: NewTransaction): Promise<Transaction> {
    const transaction = Transaction.create(input);
    await this.unitOfWork.run((context) => this.transactions.save(transaction, context));
    try {
      await publishTransactionCreated(this.publisher, transaction);
    } catch (error) {
      this.logger.warn(
        `Could not publish transaction.created for ${transaction.transactionExternalId}; the sweeper will retry: ${String(error)}`,
      );
    }
    return transaction;
  }
}
