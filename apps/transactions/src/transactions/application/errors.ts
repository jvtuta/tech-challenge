import { DomainError } from '../../shared/domain/domain-error';

export class EventPublishFailedError extends DomainError {
  readonly code = 'EVENT_PUBLISH_FAILED';
  readonly httpStatus = 503;

  constructor(
    readonly topic: string,
    override readonly cause: unknown,
  ) {
    super(`Could not publish ${topic}; the transaction was not created`);
  }
}

export class UnknownTransferTypeError extends DomainError {
  readonly code = 'UNKNOWN_TRANSFER_TYPE';
  readonly httpStatus = 422;

  constructor(transferTypeId: number) {
    super(`Transfer type ${transferTypeId} does not exist`);
  }
}

export class TransactionNotFoundError extends DomainError {
  readonly code = 'TRANSACTION_NOT_FOUND';
  readonly httpStatus = 404;

  constructor(transactionExternalId: string) {
    super(`Transaction ${transactionExternalId} was not found`);
  }
}
