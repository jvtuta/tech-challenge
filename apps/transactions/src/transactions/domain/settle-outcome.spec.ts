import { settleOutcome } from './settle-outcome';

describe('settleOutcome', () => {
  it('accepts a verdict over a pending transaction', () => {
    expect(settleOutcome('pending', 'approved')).toBe('settled');
    expect(settleOutcome('pending', 'rejected')).toBe('settled');
  });

  it('treats the same verdict again as a duplicate', () => {
    expect(settleOutcome('approved', 'approved')).toBe('duplicate');
    expect(settleOutcome('rejected', 'rejected')).toBe('duplicate');
  });

  it('treats a different verdict over a settled transaction as a conflict', () => {
    expect(settleOutcome('approved', 'rejected')).toBe('conflict');
    expect(settleOutcome('rejected', 'approved')).toBe('conflict');
  });
});
