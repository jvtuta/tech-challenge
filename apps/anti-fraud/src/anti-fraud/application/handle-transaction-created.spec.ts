import { createEnvelope, TOPICS } from '@tech-challenge/contracts';
import { InMemoryEventPublisher } from '@tech-challenge/messaging';
import { handleTransactionCreated } from './handle-transaction-created';

const transactionExternalId = '3b3a5b2e-6f1c-4c1e-9d1a-1e2f3a4b5c6d';

describe('handleTransactionCreated', () => {
  it.each([
    [250, 'approved'],
    [1000, 'approved'],
    [1500, 'rejected'],
  ] as const)(
    'publishes the verdict for value %p as %p under the same key',
    async (value, status) => {
      const publisher = new InMemoryEventPublisher();
      const event = createEnvelope(TOPICS.TRANSACTION_CREATED, { transactionExternalId, value });

      await handleTransactionCreated(publisher)(event);

      expect(publisher.published).toEqual([
        expect.objectContaining({
          topic: 'transaction.status.updated',
          key: transactionExternalId,
          envelope: expect.objectContaining({ data: { transactionExternalId, status } }),
        }),
      ]);
    },
  );

  it('lets a broker failure surface so the consumer can retry the message', async () => {
    const publisher = new InMemoryEventPublisher().failWith(new Error('broker unavailable'));
    const event = createEnvelope(TOPICS.TRANSACTION_CREATED, { transactionExternalId, value: 10 });

    await expect(handleTransactionCreated(publisher)(event)).rejects.toThrow('broker unavailable');
  });
});
