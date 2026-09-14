/**
 * Contexto de persistência de uma unidade de trabalho. Cada adapter concretiza o seu (no
 * Prisma é o cliente transacional); repositórios recebem o contexto e nunca abrem transação.
 */
export interface PersistenceContext {
  readonly kind: 'persistence-context';
}

/**
 * Executa um trabalho dentro de uma transação de persistência. Se o trabalho lançar, nada do
 * que foi gravado permanece. Genérico no contexto para que qualquer módulo o reutilize com os
 * seus repositórios, sem conhecer o adapter.
 */
export interface UnitOfWork<TContext extends PersistenceContext = PersistenceContext> {
  run<T>(work: (context: TContext) => Promise<T>): Promise<T>;
}

export const UNIT_OF_WORK = Symbol('UnitOfWork');
