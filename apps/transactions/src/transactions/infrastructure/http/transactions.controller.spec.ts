import type { TransactionResponse } from '@tech-challenge/contracts';
import type { CreateTransaction } from '../../application/create-transaction.use-case';
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

function controllerWith(found: TransactionResponse | null): TransactionsController {
  const queries = { findByExternalId: jest.fn().mockResolvedValue(found) };
  const createTransaction = { execute: jest.fn() };
  return new TransactionsController(
    createTransaction as unknown as CreateTransaction,
    queries as unknown as TransactionQueries,
  );
}

describe('GET /transactions/:transactionExternalId', () => {
  it('returns the transaction in the response contract', async () => {
    await expect(controllerWith(response).findOne(id)).resolves.toEqual(response);
  });

  it('answers not found when the id is unknown', async () => {
    await expect(controllerWith(null).findOne(id)).rejects.toBeInstanceOf(TransactionNotFoundError);
  });
});
