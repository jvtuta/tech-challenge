import { DomainError } from '../domain/domain-error';

/** Falha ao publicar um evento; quem chama decide o que fazer com o trabalho já feito. */
export class EventPublishFailedError extends DomainError {
  readonly code = 'EVENT_PUBLISH_FAILED';
  readonly kind = 'unavailable';

  constructor(
    readonly topic: string,
    cause: unknown,
  ) {
    super(`Could not publish ${topic}`, { cause });
  }
}
