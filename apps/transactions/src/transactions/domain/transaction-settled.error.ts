import { DomainError } from '../../shared/domain/domain-error';

export class TransactionAlreadySettledError extends DomainError {
  readonly code = 'TRANSACTION_ALREADY_SETTLED';
  readonly kind = 'invalid';

  constructor(transactionExternalId: string, attempted: string) {
    super(
      `Transaction ${transactionExternalId} was already settled by another verdict; it cannot become ${attempted}`,
    );
  }
}
