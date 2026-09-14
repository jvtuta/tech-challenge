import type { ArgumentsHost } from '@nestjs/common';
import { TOPICS } from '@tech-challenge/contracts';
import { Observable } from 'rxjs';
import { DiscardEventFilter, MAX_DELIVERIES } from './discard-event.filter';
import { MalformedEventError } from './envelope.pipe';

function hostAt(offset: string, partition = 0): ArgumentsHost {
  const context = {
    getMessage: () => ({ key: Buffer.from('a-key'), offset }),
    getTopic: () => TOPICS.TRANSACTION_CREATED,
    getPartition: () => partition,
  };
  return { switchToRpc: () => ({ getContext: () => context }) } as unknown as ArgumentsHost;
}

describe('DiscardEventFilter', () => {
  it('discards a message outside the event contract', () => {
    const filter = new DiscardEventFilter();

    expect(
      filter.catch(new MalformedEventError(TOPICS.TRANSACTION_CREATED), hostAt('1')),
    ).toBeInstanceOf(Observable);
  });

  it('lets the transport redeliver a broker failure until the ceiling, then gives up', () => {
    const filter = new DiscardEventFilter();
    const failure = new Error('the broker refused the verdict');

    for (let delivery = 1; delivery < MAX_DELIVERIES; delivery += 1) {
      expect(() => filter.catch(failure, hostAt('7'))).toThrow(failure);
    }

    expect(filter.catch(failure, hostAt('7'))).toBeInstanceOf(Observable);
  });
});
