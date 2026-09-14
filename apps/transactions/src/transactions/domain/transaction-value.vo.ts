import { DomainError } from '../../shared/domain/domain-error';

export class InvalidTransactionValueError extends DomainError {
  readonly code = 'INVALID_TRANSACTION_VALUE';
  readonly kind = 'invalid';

  constructor(value: number) {
    super(`Transaction value must be a positive amount with at most two decimals, got ${value}`);
  }
}

/** Valor monetário da transação: positivo, finito e com no máximo duas casas decimais. */
export class TransactionValue {
  private constructor(readonly amount: number) {}

  static of(value: number): TransactionValue {
    const hasTwoDecimalsAtMost = Math.round(value * 100) / 100 === value;
    if (!Number.isFinite(value) || value <= 0 || !hasTwoDecimalsAtMost) {
      throw new InvalidTransactionValueError(value);
    }
    return new TransactionValue(value);
  }

  toNumber(): number {
    return this.amount;
  }
}
