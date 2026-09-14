import { createEnvelope, TOPICS } from './events';

describe('createEnvelope', () => {
  it('wraps the payload with id, type, version and timestamp', () => {
    const occurredAt = new Date('2026-09-14T10:00:00.000Z');

    const event = createEnvelope(
      TOPICS.TRANSACTION_CREATED,
      { transactionExternalId: 'tx-1', value: 120 },
      { eventId: 'evt-1', occurredAt },
    );

    expect(event).toEqual({
      eventId: 'evt-1',
      eventType: 'transaction.created',
      version: 1,
      occurredAt: '2026-09-14T10:00:00.000Z',
      data: { transactionExternalId: 'tx-1', value: 120 },
    });
  });

  it('generates a unique eventId per envelope by default', () => {
    const first = createEnvelope(TOPICS.TRANSACTION_STATUS_UPDATED, {
      transactionExternalId: 'tx-1',
      status: 'approved',
    });
    const second = createEnvelope(TOPICS.TRANSACTION_STATUS_UPDATED, {
      transactionExternalId: 'tx-1',
      status: 'approved',
    });

    expect(first.eventId).not.toBe(second.eventId);
    expect(first.eventId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
