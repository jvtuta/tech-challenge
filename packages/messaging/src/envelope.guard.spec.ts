import { createEnvelope, TOPICS } from '@tech-challenge/contracts';
import { parseEnvelope } from './envelope.guard';

const created = createEnvelope(TOPICS.TRANSACTION_CREATED, {
  transactionExternalId: 'tx-1',
  value: 120,
});
const updated = createEnvelope(TOPICS.TRANSACTION_STATUS_UPDATED, {
  transactionExternalId: 'tx-1',
  status: 'approved',
});

describe('parseEnvelope', () => {
  it('accepts the envelopes the publisher produces, raw or already parsed', () => {
    expect(parseEnvelope(JSON.stringify(created))).toEqual(created);
    expect(parseEnvelope(Buffer.from(JSON.stringify(updated)))).toEqual(updated);
    expect(parseEnvelope(created)).toEqual(created);
  });

  it.each([
    ['empty payload', null],
    ['an object without the envelope fields', { hello: 'world' }],
    ['broken json', '{not json'],
    ['a json that is not an object', '[1, 2]'],
    ['unknown topic', JSON.stringify({ ...created, eventType: 'transaction.deleted' })],
    ['another version', JSON.stringify({ ...created, version: 2 })],
    ['missing event id', JSON.stringify({ ...created, eventId: '' })],
    [
      'created without numeric value',
      JSON.stringify({ ...created, data: { transactionExternalId: 'tx-1', value: '120' } }),
    ],
    [
      'status outside the final ones',
      JSON.stringify({ ...updated, data: { transactionExternalId: 'tx-1', status: 'pending' } }),
    ],
    ['data without transaction id', JSON.stringify({ ...updated, data: { status: 'approved' } })],
  ])('rejects %s', (_label, raw) => {
    expect(parseEnvelope(raw)).toBeNull();
  });
});
