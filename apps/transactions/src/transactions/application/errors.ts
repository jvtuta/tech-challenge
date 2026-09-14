import { DomainError } from '../../shared/domain/domain-error';

export class EventPublishFailedError extends DomainError {
  readonly code = 'EVENT_PUBLISH_FAILED';
  readonly kind = 'unavailable';

  constructor(
    readonly topic: string,
    override readonly cause: unknown,
  ) {
    super(`Could not publish ${topic}; the transaction was not created`);
  }
}

export class UnknownTransferTypeError extends DomainError {
  readonly code = 'UNKNOWN_TRANSFER_TYPE';
  readonly kind = 'invalid';

  constructor(transferTypeId: number) {
    super(`Transfer type ${transferTypeId} does not exist`);
  }
}

export class TransactionNotFoundError extends DomainError {
  readonly code = 'TRANSACTION_NOT_FOUND';
  readonly kind = 'not-found';

  constructor(transactionExternalId: string) {
    super(`Transaction ${transactionExternalId} was not found`);
  }
}
