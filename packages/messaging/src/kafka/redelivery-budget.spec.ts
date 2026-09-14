import { RedeliveryBudget } from './redelivery-budget';

describe('RedeliveryBudget', () => {
  it('counts the deliveries of the same offset until the budget runs out', () => {
    const budget = new RedeliveryBudget(3);

    expect(budget.spend('t', 0, '10')).toEqual({ deliveries: 1, exhausted: false });
    expect(budget.spend('t', 0, '10')).toEqual({ deliveries: 2, exhausted: false });
    expect(budget.spend('t', 0, '10')).toEqual({ deliveries: 3, exhausted: true });
  });

  it('starts over when the partition moves to the next offset', () => {
    const budget = new RedeliveryBudget(3);

    budget.spend('t', 0, '10');
    budget.spend('t', 0, '10');

    expect(budget.spend('t', 0, '11')).toEqual({ deliveries: 1, exhausted: false });
  });

  it('counts each partition on its own', () => {
    const budget = new RedeliveryBudget(2);

    expect(budget.spend('t', 0, '10')).toEqual({ deliveries: 1, exhausted: false });
    expect(budget.spend('t', 1, '10')).toEqual({ deliveries: 1, exhausted: false });
    expect(budget.spend('t', 0, '10')).toEqual({ deliveries: 2, exhausted: true });
  });

  it('gives the next message of the partition a full budget', () => {
    const budget = new RedeliveryBudget(2);

    budget.spend('t', 0, '10');
    budget.spend('t', 0, '10');

    expect(budget.spend('t', 0, '11')).toEqual({ deliveries: 1, exhausted: false });
  });
});
