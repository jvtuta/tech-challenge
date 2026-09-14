/**
 * Erro de negócio. Carrega o status HTTP que o filtro global usa na borda, para que o
 * domínio e a aplicação não dependam de exceções do NestJS.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
