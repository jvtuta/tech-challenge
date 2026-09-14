import { TOPICS } from '@tech-challenge/contracts';
import { dispatch } from './event-dispatch';
import { InMemoryEventPublisher } from './testing/in-memory-event-publisher';

describe('dispatch', () => {
  const occurredAt = new Date('2026-09-14T06:30:00.000Z');

  it('publishes the envelope keyed by the transaction id', async () => {
    const publisher = new InMemoryEventPublisher();

    const envelope = await dispatch(publisher)
      .event(TOPICS.TRANSACTION_CREATED)
      .keyedBy('tx-1')
      .with({ transactionExternalId: 'tx-1', value: 120 })
      .withEventId('evt-1')
      .occurredAt(occurredAt)
      .publish();

    expect(publisher.published).toEqual([
      {
        topic: 'transaction.created',
        key: 'tx-1',
        envelope: {
          eventId: 'evt-1',
          eventType: 'transaction.created',
          version: 1,
          occurredAt: '2026-09-14T06:30:00.000Z',
          data: { transactionExternalId: 'tx-1', value: 120 },
        },
      },
    ]);
    expect(envelope).toBe(publisher.lastPublished()?.envelope);
  });

  it('keeps every event of the same transaction under the same key', async () => {
    const publisher = new InMemoryEventPublisher();
    const events = dispatch(publisher);

    await events
      .event(TOPICS.TRANSACTION_CREATED)
      .keyedBy('tx-1')
      .with({ transactionExternalId: 'tx-1', value: 50 })
      .publish();
    await events
      .event(TOPICS.TRANSACTION_STATUS_UPDATED)
      .keyedBy('tx-1')
      .with({ transactionExternalId: 'tx-1', status: 'approved' })
      .publish();

    expect(publisher.published.map((event) => event.key)).toEqual(['tx-1', 'tx-1']);
    expect(publisher.published.map((event) => event.envelope.eventId)).not.toContain(undefined);
  });

  it('refuses an empty key: without it the broker would not preserve order', () => {
    const publisher = new InMemoryEventPublisher();

    expect(() =>
      dispatch(publisher)
        .event(TOPICS.TRANSACTION_CREATED)
        .keyedBy('  ')
        .with({ transactionExternalId: 'tx-1', value: 1 }),
    ).toThrow('requires a non-empty key');
    expect(publisher.published).toHaveLength(0);
  });

  it('propagates the broker failure so the caller decides what to do', async () => {
    const publisher = new InMemoryEventPublisher().failWith(new Error('broker unavailable'));

    await expect(
      dispatch(publisher)
        .event(TOPICS.TRANSACTION_STATUS_UPDATED)
        .keyedBy('tx-1')
        .with({ transactionExternalId: 'tx-1', status: 'rejected' })
        .publish(),
    ).rejects.toThrow('broker unavailable');
    expect(publisher.published).toHaveLength(0);
  });
});
