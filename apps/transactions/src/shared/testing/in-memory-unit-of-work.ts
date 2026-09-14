import type { PersistenceContext, UnitOfWork } from '../application/unit-of-work';

/** Qualquer loja em memória que saiba tirar e restaurar um retrato do seu estado. */
export interface Snapshotable {
  snapshot(): () => void;
}

const context: PersistenceContext = { kind: 'persistence-context' };

/** Mesma semântica do adapter Prisma: falhou, restaura todas as lojas envolvidas. */
export class InMemoryUnitOfWork implements UnitOfWork {
  constructor(private readonly stores: Snapshotable[]) {}

  async run<T>(work: (context: PersistenceContext) => Promise<T>): Promise<T> {
    const restores = this.stores.map((store) => store.snapshot());
    try {
      return await work(context);
    } catch (error) {
      restores.forEach((restore) => restore());
      throw error;
    }
  }
}
