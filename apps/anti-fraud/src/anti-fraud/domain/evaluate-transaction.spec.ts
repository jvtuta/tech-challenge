import { APPROVAL_LIMIT, evaluateTransaction } from './evaluate-transaction';

const transactionExternalId = '3b3a5b2e-6f1c-4c1e-9d1a-1e2f3a4b5c6d';

describe('evaluateTransaction', () => {
  it('sets the limit the statement defines', () => {
    expect(APPROVAL_LIMIT).toBe(1000);
  });

  it.each([0.01, 1, 500, 999.99, 1000])('approves %p (at or below the limit)', (value) => {
    expect(evaluateTransaction({ transactionExternalId, value })).toBe('approved');
  });

  it.each([1000.01, 1001, 5000, 250000])('rejects %p (above the limit)', (value) => {
    expect(evaluateTransaction({ transactionExternalId, value })).toBe('rejected');
  });

  it('decides only by the value, not by the transaction identity', () => {
    const verdicts = ['a', 'b', 'c'].map((id) =>
      evaluateTransaction({ transactionExternalId: id, value: 1000 }),
    );

    expect(new Set(verdicts)).toEqual(new Set(['approved']));
  });
});
