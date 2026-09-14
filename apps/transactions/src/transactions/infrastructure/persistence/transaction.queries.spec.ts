import { TRANSACTION_SORT_FIELDS, type TransactionFilter } from '@tech-challenge/contracts';
import { SearchParams } from '../../../shared/domain/searchable-repository';
import { toOrderBy, toWhere } from './transaction.queries';

describe('toWhere', () => {
  it('translates only the informed filters', () => {
    expect(toWhere(null)).toEqual({});
    expect(toWhere({ status: 'pending', transferTypeId: 2 })).toEqual({
      status: 'pending',
      transferTypeId: 2,
      createdAt: undefined,
    });
  });

  it('turns the period into a range on createdAt', () => {
    expect(toWhere({ from: '2026-09-01T00:00:00.000Z' }).createdAt).toEqual({
      gte: '2026-09-01T00:00:00.000Z',
      lte: undefined,
    });
  });
});

describe('toOrderBy', () => {
  it('orders by the requested sortable field and direction', () => {
    const params = new SearchParams<TransactionFilter>({ sort: 'value', sortDir: 'asc' });

    expect(toOrderBy(params, TRANSACTION_SORT_FIELDS)).toEqual({ value: 'asc' });
  });

  it('falls back to the most recent first without a sort or with an unknown field', () => {
    expect(toOrderBy(new SearchParams<TransactionFilter>({}), TRANSACTION_SORT_FIELDS)).toEqual({
      createdAt: 'desc',
    });
    expect(
      toOrderBy(new SearchParams<TransactionFilter>({ sort: 'status' }), TRANSACTION_SORT_FIELDS),
    ).toEqual({
      createdAt: 'desc',
    });
  });
});
