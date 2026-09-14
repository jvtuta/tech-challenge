import type { ArgumentsHost } from '@nestjs/common';
import { TOPICS } from '@tech-challenge/contracts';
import { Observable } from 'rxjs';
import { TransactionNotFoundError } from '../../../transactions/application/errors';
import { DiscardEventFilter, MAX_DELIVERIES } from './discard-event.filter';
import { MalformedEventError } from './envelope.pipe';

function hostAt(offset: string, partition = 0): ArgumentsHost {
  const context = {
    getMessage: () => ({ key: Buffer.from('a-key'), offset }),
    getTopic: () => TOPICS.TRANSACTION_STATUS_UPDATED,
    getPartition: () => partition,
  };
  return { switchToRpc: () => ({ getContext: () => context }) } as unknown as ArgumentsHost;
}

describe('DiscardEventFilter', () => {
  it('discards what will never work: outside the contract or a deterministic business error', () => {
    const filter = new DiscardEventFilter();

    expect(
      filter.catch(new MalformedEventError(TOPICS.TRANSACTION_STATUS_UPDATED), hostAt('1')),
    ).toBeInstanceOf(Observable);
    expect(filter.catch(new TransactionNotFoundError('unknown-id'), hostAt('2'))).toBeInstanceOf(
      Observable,
    );
  });

  it('lets the transport redeliver a transient failure until the ceiling, then gives up', () => {
    const filter = new DiscardEventFilter();
    const failure = new Error('the database is unreachable');

    for (let delivery = 1; delivery < MAX_DELIVERIES; delivery += 1) {
      expect(() => filter.catch(failure, hostAt('7'))).toThrow(failure);
    }

    expect(filter.catch(failure, hostAt('7'))).toBeInstanceOf(Observable);
  });

  it('does not spend the budget of a message on the deterministic errors of the ones before it', () => {
    const filter = new DiscardEventFilter();
    const failure = new Error('the database is unreachable');

    filter.catch(new MalformedEventError(TOPICS.TRANSACTION_STATUS_UPDATED), hostAt('7'));

    expect(() => filter.catch(failure, hostAt('7'))).toThrow(failure);
  });
});
