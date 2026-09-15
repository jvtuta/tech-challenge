import type { Snapshotable } from '../../shared/testing/in-memory-unit-of-work';
import { Transaction, type FinalStatus } from '../domain/transaction';
import { settleOutcome } from '../domain/settle-outcome';
import type { SettleResult, TransactionRepository } from '../domain/transaction.repository';
import { TransactionValue } from '../domain/transaction-value.vo';

export class InMemoryTransactionRepository implements TransactionRepository, Snapshotable {
  private rows = new Map<string, Transaction>();

  async save(transaction: Transaction): Promise<void> {
    this.rows.set(transaction.transactionExternalId, transaction);
  }

  /** Mesma semântica condicional do adapter Prisma: grava só se ainda estiver pendente. */
  async settle(transactionExternalId: string, status: FinalStatus): Promise<SettleResult> {
    const current = this.rows.get(transactionExternalId);
    if (!current) {
      return 'not-found';
    }
    const outcome = settleOutcome(current.status, status);
    if (outcome === 'settled') {
      this.rows.set(
        transactionExternalId,
        Transaction.restore({
          transactionExternalId: current.transactionExternalId,
          accountExternalIdDebit: current.accountExternalIdDebit,
          accountExternalIdCredit: current.accountExternalIdCredit,
          transferTypeId: current.transferTypeId,
          value: TransactionValue.of(current.value),
          status,
          createdAt: current.createdAt,
        }),
      );
    }
    return outcome;
  }

  async findByExternalId(transactionExternalId: string): Promise<Transaction | null> {
    return this.rows.get(transactionExternalId) ?? null;
  }

  async findPendingOlderThan(cutoff: Date, limit: number): Promise<Transaction[]> {
    return [...this.rows.values()]
      .filter((transaction) => transaction.status === 'pending' && transaction.createdAt < cutoff)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit);
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
