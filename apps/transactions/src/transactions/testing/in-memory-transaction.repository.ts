import type { Snapshotable } from '../../shared/testing/in-memory-unit-of-work';
import type { Transaction } from '../domain/transaction';
import type { TransactionRepository } from '../domain/transaction.repository';

export class InMemoryTransactionRepository implements TransactionRepository, Snapshotable {
  private rows = new Map<string, Transaction>();

  async save(transaction: Transaction): Promise<void> {
    this.rows.set(transaction.transactionExternalId, transaction);
  }

  async findByExternalId(transactionExternalId: string): Promise<Transaction | null> {
    return this.rows.get(transactionExternalId) ?? null;
  }

  snapshot(): () => void {
    const copy = new Map(this.rows);
    return () => {
      this.rows = copy;
    };
  }

  get size(): number {
    return this.rows.size;
  }
}
