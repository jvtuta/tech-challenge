import { InMemoryEventPublisher } from '@tech-challenge/messaging';
import { InMemoryUnitOfWork } from '../../shared/testing/in-memory-unit-of-work';
import { InMemoryTransactionRepository } from '../testing/in-memory-transaction.repository';
import { CreateTransaction } from './create-transaction.use-case';

const input = {
  accountExternalIdDebit: '3b3a5b2e-6f1c-4c1e-9d1a-1e2f3a4b5c6d',
  accountExternalIdCredit: '9d8c7b6a-5f4e-4d3c-8b2a-1a0f9e8d7c6b',
  transferTypeId: 1,
  value: 120,
};

function setup(publisher = new InMemoryEventPublisher()) {
  const repository = new InMemoryTransactionRepository();
  const useCase = new CreateTransaction(
    repository,
    new InMemoryUnitOfWork([repository]),
    publisher,
  );
  return { repository, publisher, useCase };
}

describe('CreateTransaction', () => {
  it('persists the transaction as pending and publishes transaction.created keyed by its id', async () => {
    const { repository, publisher, useCase } = setup();

    const transaction = await useCase.execute(input);

    expect(transaction.status).toBe('pending');
    await expect(repository.findByExternalId(transaction.transactionExternalId)).resolves.toBe(
      transaction,
    );
    expect(publisher.lastPublished()).toMatchObject({
      topic: 'transaction.created',
      key: transaction.transactionExternalId,
      envelope: {
        eventType: 'transaction.created',
        data: { transactionExternalId: transaction.transactionExternalId, value: 120 },
      },
    });
  });

  it('keeps the transaction when the event cannot be published; the sweeper will retry', async () => {
    const { repository, publisher, useCase } = setup(
      new InMemoryEventPublisher().failWith(new Error('broker unavailable')),
    );

    const transaction = await useCase.execute(input);

    expect(transaction.status).toBe('pending');
    expect(repository.size).toBe(1);
    expect(publisher.published).toHaveLength(0);
  });

  it('rejects an invalid value before touching persistence or the broker', async () => {
    const { repository, publisher, useCase } = setup();

    await expect(useCase.execute({ ...input, value: -5 })).rejects.toThrow(
      'Transaction value must be a positive amount',
    );
    expect(repository.size).toBe(0);
    expect(publisher.published).toHaveLength(0);
  });
});
