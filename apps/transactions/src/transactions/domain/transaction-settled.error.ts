import { DomainError } from '../../shared/domain/domain-error';

export class TransactionAlreadySettledError extends DomainError {
  readonly code = 'TRANSACTION_ALREADY_SETTLED';
  readonly kind = 'invalid';

  constructor(transactionExternalId: string, current: string, attempted: string) {
    super(
      `Transaction ${transactionExternalId} is already ${current}; it cannot become ${attempted}`,
    );
  }
}
