import type { Transaction } from './transaction';

/** Contexto de persistência de uma unidade de trabalho (a transação do banco, no Prisma). */
export interface PersistenceContext {
  readonly kind: 'persistence-context';
}

export interface TransactionRepository {
  save(transaction: Transaction, context: PersistenceContext): Promise<void>;
  findByExternalId(transactionExternalId: string): Promise<Transaction | null>;
}

export const TRANSACTION_REPOSITORY = Symbol('TransactionRepository');
