/**
 * Categoria semântica do erro de negócio. Cada borda traduz para o seu protocolo: o filtro
 * HTTP escolhe o status; um consumidor de mensagens decide entre descartar e reprocessar.
 */
export type DomainErrorKind = 'invalid' | 'not-found' | 'unavailable';

export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly kind: DomainErrorKind;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
