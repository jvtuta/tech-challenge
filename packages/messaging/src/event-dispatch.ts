import {
  createEnvelope,
  type EnvelopeOptions,
  type EventEnvelope,
  type PayloadOf,
  type TopicName,
} from '@tech-challenge/contracts';
import type { EventPublisher } from './event-publisher.port';

export class EventDispatch<TTopic extends TopicName> {
  private options: EnvelopeOptions = {};

  constructor(
    private readonly publisher: EventPublisher,
    private readonly topic: TTopic,
    private readonly key: string,
    private readonly data: PayloadOf<TTopic>,
  ) {
    if (key.trim() === '') {
      throw new Error(`Event ${topic} requires a non-empty key`);
    }
  }

  occurredAt(date: Date): this {
    this.options = { ...this.options, occurredAt: date };
    return this;
  }

  withEventId(eventId: string): this {
    this.options = { ...this.options, eventId };
    return this;
  }

  async publish(): Promise<EventEnvelope<TTopic>> {
    const envelope = createEnvelope(this.topic, this.data, this.options);
    await this.publisher.publish({ topic: this.topic, key: this.key, envelope });
    return envelope;
  }
}

class KeyedEvent<TTopic extends TopicName> {
  constructor(
    private readonly publisher: EventPublisher,
    private readonly topic: TTopic,
    private readonly key: string,
  ) {}

  with(data: PayloadOf<TTopic>): EventDispatch<TTopic> {
    return new EventDispatch(this.publisher, this.topic, this.key, data);
  }
}

class EventDraft<TTopic extends TopicName> {
  constructor(
    private readonly publisher: EventPublisher,
    private readonly topic: TTopic,
  ) {}

  keyedBy(key: string): KeyedEvent<TTopic> {
    return new KeyedEvent(this.publisher, this.topic, key);
  }
}

/**
 * Entrada da interface fluente:
 *
 *   await dispatch(publisher)
 *     .event(TOPICS.TRANSACTION_CREATED)
 *     .keyedBy(transaction.transactionExternalId)
 *     .with({ transactionExternalId, value })
 *     .publish();
 */
export function dispatch(publisher: EventPublisher) {
  return {
    event<TTopic extends TopicName>(topic: TTopic): EventDraft<TTopic> {
      return new EventDraft(publisher, topic);
    },
  };
}
