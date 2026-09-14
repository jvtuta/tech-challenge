import type { PersistenceContext } from '../../shared/application/unit-of-work';
import type { Transaction } from './transaction';

export type { PersistenceContext };

export interface TransactionRepository {
  save(transaction: Transaction, context: PersistenceContext): Promise<void>;
  findByExternalId(transactionExternalId: string): Promise<Transaction | null>;
}

export const TRANSACTION_REPOSITORY = Symbol('TransactionRepository');
