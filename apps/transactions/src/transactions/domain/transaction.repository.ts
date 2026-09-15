import type { PersistenceContext } from '../../shared/application/unit-of-work';
import type { SettleOutcome } from './settle-outcome';
import type { FinalStatus, Transaction } from './transaction';

export type { PersistenceContext };

/** O que a persistência devolve ao aplicar um veredito, incluindo o id que nunca existiu. */
export type SettleResult = SettleOutcome | 'not-found';

export interface TransactionRepository {
  save(transaction: Transaction, context: PersistenceContext): Promise<void>;
  /**
   * Aplica o veredito em uma escrita condicionada a a transação ainda estar pendente, e diz o
   * que aconteceu. Ler para decidir e depois gravar pelo id deixaria duas execuções
   * concorrentes passarem as duas; aqui quem decide é o banco, e só uma escrita casa.
   */
  settle(
    transactionExternalId: string,
    status: FinalStatus,
    context: PersistenceContext,
  ): Promise<SettleResult>;
  findByExternalId(transactionExternalId: string): Promise<Transaction | null>;
  findPendingOlderThan(cutoff: Date, limit: number): Promise<Transaction[]>;
}

export const TRANSACTION_REPOSITORY = Symbol('TransactionRepository');
