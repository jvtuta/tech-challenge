import { InMemoryUnitOfWork } from '../../shared/testing/in-memory-unit-of-work';
import { Transaction } from '../domain/transaction';
import { TransactionAlreadySettledError } from '../domain/transaction-settled.error';
import { InMemoryTransactionRepository } from '../testing/in-memory-transaction.repository';
import { TransactionNotFoundError } from './errors';
import { UpdateTransactionStatus } from './update-transaction-status.use-case';

const input = {
  accountExternalIdDebit: '3b3a5b2e-6f1c-4c1e-9d1a-1e2f3a4b5c6d',
  accountExternalIdCredit: '9d8c7b6a-5f4e-4d3c-8b2a-1a0f9e8d7c6b',
  transferTypeId: 1,
  value: 120,
};

interface Setup {
  useCase: UpdateTransactionStatus;
  repository: InMemoryTransactionRepository;
  transactionExternalId: string;
}

async function setup(): Promise<Setup> {
  const repository = new InMemoryTransactionRepository();
  const transaction = Transaction.create(input);
  await repository.save(transaction);
  return {
    useCase: new UpdateTransactionStatus(repository, new InMemoryUnitOfWork([repository])),
    repository,
    transactionExternalId: transaction.transactionExternalId,
  };
}

const statusOf = async (
  repository: InMemoryTransactionRepository,
  transactionExternalId: string,
): Promise<string | undefined> =>
  (await repository.findByExternalId(transactionExternalId))?.status;

describe('UpdateTransactionStatus', () => {
  it('applies the verdict to a pending transaction', async () => {
    const { useCase, repository, transactionExternalId } = await setup();

    await expect(useCase.execute({ transactionExternalId, status: 'approved' })).resolves.toBe(
      true,
    );
    await expect(statusOf(repository, transactionExternalId)).resolves.toBe('approved');
  });

  it('does nothing when the same verdict arrives again', async () => {
    const { useCase, repository, transactionExternalId } = await setup();
    const update = { transactionExternalId, status: 'rejected' as const };
    await useCase.execute(update);

    await expect(useCase.execute(update)).resolves.toBe(false);
    await expect(statusOf(repository, transactionExternalId)).resolves.toBe('rejected');
  });

  it('refuses a conflicting verdict and keeps the first one', async () => {
    const { useCase, repository, transactionExternalId } = await setup();
    await useCase.execute({ transactionExternalId, status: 'approved' });

    await expect(
      useCase.execute({ transactionExternalId, status: 'rejected' }),
    ).rejects.toBeInstanceOf(TransactionAlreadySettledError);
    await expect(statusOf(repository, transactionExternalId)).resolves.toBe('approved');
  });

  it('reports an unknown transaction', async () => {
    const { useCase } = await setup();

    await expect(
      useCase.execute({
        transactionExternalId: '9d8c7b6a-5f4e-4d3c-8b2a-1a0f9e8d7c6b',
        status: 'approved',
      }),
    ).rejects.toBeInstanceOf(TransactionNotFoundError);
  });

  it('reports exactly one transition when the same verdict is applied concurrently', async () => {
    const { useCase, repository, transactionExternalId } = await setup();
    const update = { transactionExternalId, status: 'approved' as const };

    const results = await Promise.all([useCase.execute(update), useCase.execute(update)]);

    expect(results.filter(Boolean)).toHaveLength(1);
    await expect(statusOf(repository, transactionExternalId)).resolves.toBe('approved');
  });
});
