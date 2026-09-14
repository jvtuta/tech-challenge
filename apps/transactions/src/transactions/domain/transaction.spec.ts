import { Transaction } from './transaction';
import { InvalidTransactionValueError, TransactionValue } from './transaction-value';

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
