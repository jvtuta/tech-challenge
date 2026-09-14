import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWork } from '../../shared/application/unit-of-work';
import type { FinalStatus } from '../domain/transaction';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepository,
} from '../domain/transaction.repository';
import { TransactionNotFoundError } from './errors';

export interface StatusUpdate {
  transactionExternalId: string;
  status: FinalStatus;
}

@Injectable()
export class UpdateTransactionStatus {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  /** Devolve `true` quando o status mudou e `false` quando o veredito já estava aplicado. */
  async execute({ transactionExternalId, status }: StatusUpdate): Promise<boolean> {
    const transaction = await this.transactions.findByExternalId(transactionExternalId);
    if (!transaction) {
      throw new TransactionNotFoundError(transactionExternalId);
    }
    if (!transaction.settle(status)) {
      return false;
    }
    await this.unitOfWork.run((context) => this.transactions.update(transaction, context));
    return true;
  }
}
