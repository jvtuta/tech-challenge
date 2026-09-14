import { InMemoryEventPublisher } from '@tech-challenge/messaging';
import { InMemoryUnitOfWork } from '../../shared/testing/in-memory-unit-of-work';
import { InMemoryTransactionRepository } from '../testing/in-memory-transaction.repository';
import { CreateTransaction } from './create-transaction.use-case';
import { EventPublishFailedError } from '../../shared/application/errors';

describe('CreateTransaction', () => {
  const input = {
    accountExternalIdDebit: '3b3a5b2e-6f1c-4c1e-9d1a-1e2f3a4b5c6d',
    accountExternalIdCredit: '9d8c7b6a-5f4e-4d3c-8b2a-1a0f9e8d7c6b',
    transferTypeId: 1,
    value: 120,
  };

  it('persists the transaction as pending and publishes transaction.created keyed by its id', async () => {
    const repository = new InMemoryTransactionRepository();
    const publisher = new InMemoryEventPublisher();
    const useCase = new CreateTransaction(
      repository,
      new InMemoryUnitOfWork([repository]),
      publisher,
    );

    const transaction = await useCase.execute(input);

    expect(transaction.status).toBe('pending');
    await expect(repository.findByExternalId(transaction.transactionExternalId)).resolves.toBe(
      transaction,
    );
    expect(publisher.published).toHaveLength(1);
    expect(publisher.lastPublished()).toMatchObject({
      topic: 'transaction.created',
      key: transaction.transactionExternalId,
      envelope: {
        eventType: 'transaction.created',
        data: { transactionExternalId: transaction.transactionExternalId, value: 120 },
      },
    });
  });

  it('does not keep the transaction when the event cannot be published', async () => {
    const repository = new InMemoryTransactionRepository();
    const publisher = new InMemoryEventPublisher().failWith(new Error('broker unavailable'));
    const useCase = new CreateTransaction(
      repository,
      new InMemoryUnitOfWork([repository]),
      publisher,
    );

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(EventPublishFailedError);
    expect(repository.size).toBe(0);
  });

  it('rejects an invalid value before touching persistence or the broker', async () => {
    const repository = new InMemoryTransactionRepository();
    const publisher = new InMemoryEventPublisher();
    const useCase = new CreateTransaction(
      repository,
      new InMemoryUnitOfWork([repository]),
      publisher,
    );

    await expect(useCase.execute({ ...input, value: -5 })).rejects.toThrow(
      'Transaction value must be a positive amount',
    );
    expect(repository.size).toBe(0);
    expect(publisher.published).toHaveLength(0);
  });
});
