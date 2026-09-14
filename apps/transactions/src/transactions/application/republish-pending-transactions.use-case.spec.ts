import { InMemoryEventPublisher } from '@tech-challenge/messaging';
import { Transaction } from '../domain/transaction';
import { InMemoryTransactionRepository } from '../testing/in-memory-transaction.repository';
import { RepublishPendingTransactions } from './republish-pending-transactions.use-case';

const input = {
  accountExternalIdDebit: '3b3a5b2e-6f1c-4c1e-9d1a-1e2f3a4b5c6d',
  accountExternalIdCredit: '9d8c7b6a-5f4e-4d3c-8b2a-1a0f9e8d7c6b',
  transferTypeId: 1,
  value: 120,
};
const cutoff = new Date('2026-09-14T12:00:00.000Z');
const before = new Date('2026-09-14T11:59:00.000Z');
const after = new Date('2026-09-14T12:00:30.000Z');

describe('RepublishPendingTransactions', () => {
  it('republishes only the transactions still pending before the cutoff', async () => {
    const repository = new InMemoryTransactionRepository();
    const stale = Transaction.create(input, before);
    const recent = Transaction.create(input, after);
    const settled = Transaction.create(input, before);
    settled.settle('approved');
    await Promise.all([stale, recent, settled].map((t) => repository.save(t)));
    const publisher = new InMemoryEventPublisher();

    const count = await new RepublishPendingTransactions(repository, publisher).execute(cutoff);

    expect(count).toBe(1);
    expect(publisher.published.map((event) => event.key)).toEqual([stale.transactionExternalId]);
  });

  it('does not let one failed publication stop the others', async () => {
    const repository = new InMemoryTransactionRepository();
    const first = Transaction.create(input, before);
    const second = Transaction.create(input, before);
    await repository.save(first);
    await repository.save(second);
    const publisher = new InMemoryEventPublisher();
    const failing = {
      publish: jest
        .fn()
        .mockRejectedValueOnce(new Error('broker unavailable'))
        .mockImplementation((event) => publisher.publish(event)),
    };

    const count = await new RepublishPendingTransactions(repository, failing).execute(cutoff);

    expect(count).toBe(1);
    expect(publisher.published).toHaveLength(1);
  });
});
