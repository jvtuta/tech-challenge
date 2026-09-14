import type { TransactionResponse } from '@tech-challenge/contracts';
import type { CreateTransaction } from '../../application/create-transaction.use-case';
import { SearchParams, SearchResult } from '../../../shared/domain/searchable-repository';
import { TransactionNotFoundError } from '../../application/errors';
import type { TransactionQueries } from '../persistence/transaction.queries';
import { TransactionsController } from './transactions.controller';

const id = '3b3a5b2e-6f1c-4c1e-9d1a-1e2f3a4b5c6d';
const response: TransactionResponse = {
  transactionExternalId: id,
  transactionType: { name: 'transfer' },
  transactionStatus: { name: 'pending' },
  value: 120,
  createdAt: '2026-09-14T09:00:00.000Z',
};

function controllerWith(found: TransactionResponse | null) {
  const queries = {
    findByExternalId: jest.fn().mockResolvedValue(found),
    search: jest.fn(async (params: SearchParams<unknown>) => {
      return new SearchResult({ items: found ? [found] : [], total: found ? 1 : 0, params });
    }),
  };
  const createTransaction = { execute: jest.fn() };
  const controller = new TransactionsController(
    createTransaction as unknown as CreateTransaction,
    queries as unknown as TransactionQueries,
  );
  return { controller, queries };
}

describe('GET /transactions', () => {
  it('turns the query into search params and the result into the page contract', async () => {
    const { controller, queries } = controllerWith(response);

    const page = await controller.list({ status: 'pending', pageSize: 5, sort: 'value' });

    expect(queries.search).toHaveBeenCalledWith(
      new SearchParams({ perPage: 5, sort: 'value', filter: { status: 'pending' } }),
    );
    expect(page).toEqual({ items: [response], page: 1, pageSize: 5, total: 1 });
  });
});

describe('GET /transactions/:transactionExternalId', () => {
  it('returns the transaction in the response contract', async () => {
    await expect(controllerWith(response).controller.findOne(id)).resolves.toEqual(response);
  });

  it('answers not found when the id is unknown', async () => {
    await expect(controllerWith(null).controller.findOne(id)).rejects.toBeInstanceOf(
      TransactionNotFoundError,
    );
  });
});
