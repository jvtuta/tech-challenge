import type { UnitOfWork } from '../application/unit-of-work';
import type { Transaction } from '../domain/transaction';
import type { PersistenceContext, TransactionRepository } from '../domain/transaction.repository';

const context: PersistenceContext = { kind: 'persistence-context' };

/** Repositório em memória com a mesma semântica transacional do Prisma: falhou, desfaz. */
export class InMemoryTransactionRepository implements TransactionRepository, UnitOfWork {
  private rows = new Map<string, Transaction>();

  async save(transaction: Transaction): Promise<void> {
    this.rows.set(transaction.transactionExternalId, transaction);
  }

  async findByExternalId(transactionExternalId: string): Promise<Transaction | null> {
    return this.rows.get(transactionExternalId) ?? null;
  }

  async run<T>(work: (context: PersistenceContext) => Promise<T>): Promise<T> {
    const snapshot = new Map(this.rows);
    try {
      return await work(context);
    } catch (error) {
      this.rows = snapshot;
      throw error;
    }
  }

  get size(): number {
    return this.rows.size;
  }
}
