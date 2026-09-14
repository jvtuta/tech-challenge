import type { PersistenceContext } from '../domain/transaction.repository';

/**
 * Executa um trabalho dentro de uma transação de persistência. Se o trabalho lançar, nada do
 * que foi gravado permanece; é o que garante que uma transação só existe se o evento saiu.
 */
export interface UnitOfWork {
  run<T>(work: (context: PersistenceContext) => Promise<T>): Promise<T>;
}

export const UNIT_OF_WORK = Symbol('UnitOfWork');
