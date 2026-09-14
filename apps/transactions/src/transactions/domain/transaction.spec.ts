import { Transaction } from './transaction';
import { TransactionAlreadySettledError } from './transaction-settled.error';
import { InvalidTransactionValueError, TransactionValue } from './transaction-value.vo';

describe('TransactionValue', () => {
  it.each([0.01, 1, 999.99, 1000, 1000.01, 250000])('accepts %p', (value) => {
    expect(TransactionValue.of(value).toNumber()).toBe(value);
  });

  it.each([0, -1, 10.005, Number.NaN, Number.POSITIVE_INFINITY])('rejects %p', (value) => {
    expect(() => TransactionValue.of(value)).toThrow(InvalidTransactionValueError);
  });
});

describe('Transaction.create', () => {
  const input = {
    accountExternalIdDebit: '3b3a5b2e-6f1c-4c1e-9d1a-1e2f3a4b5c6d',
    accountExternalIdCredit: '9d8c7b6a-5f4e-4d3c-8b2a-1a0f9e8d7c6b',
    transferTypeId: 1,
    value: 120,
  };

  it('starts pending with a generated external id', () => {
    const now = new Date('2026-09-14T09:00:00.000Z');

    const transaction = Transaction.create(input, now);

    expect(transaction.status).toBe('pending');
    expect(transaction.transactionExternalId).toMatch(/^[0-9a-f-]{36}$/);
    expect(transaction.value).toBe(120);
    expect(transaction.createdAt).toBe(now);
  });

  it('gives every transaction its own id', () => {
    expect(Transaction.create(input).transactionExternalId).not.toBe(
      Transaction.create(input).transactionExternalId,
    );
  });
});

describe('Transaction.settle', () => {
  const input = {
    accountExternalIdDebit: '3b3a5b2e-6f1c-4c1e-9d1a-1e2f3a4b5c6d',
    accountExternalIdCredit: '9d8c7b6a-5f4e-4d3c-8b2a-1a0f9e8d7c6b',
    transferTypeId: 1,
    value: 120,
  };

  it('moves a pending transaction to the verdict and reports the change', () => {
    const transaction = Transaction.create(input);

    expect(transaction.settle('approved')).toBe(true);
    expect(transaction.status).toBe('approved');
  });

  it('ignores the same verdict delivered twice', () => {
    const transaction = Transaction.create(input);
    transaction.settle('rejected');

    expect(transaction.settle('rejected')).toBe(false);
    expect(transaction.status).toBe('rejected');
  });

  it('refuses a different verdict once the transaction is settled', () => {
    const transaction = Transaction.create(input);
    transaction.settle('approved');

    expect(() => transaction.settle('rejected')).toThrow(TransactionAlreadySettledError);
    expect(transaction.status).toBe('approved');
  });
});
