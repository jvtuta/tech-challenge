import {
  createEnvelope,
  type TOPICS,
  type EnvelopeOptions,
  type EventEnvelope,
  type TopicName,
  type TransactionCreatedData,
  type TransactionStatusUpdatedData,
} from '@tech-challenge/contracts';
import type { EventPublisher } from './event-publisher.port';

/** Payload aceito por cada tópico; `with()` só compila com o dado certo para o evento. */
export type PayloadOf<TType extends TopicName> = TType extends typeof TOPICS.TRANSACTION_CREATED
  ? TransactionCreatedData
  : TType extends typeof TOPICS.TRANSACTION_STATUS_UPDATED
    ? TransactionStatusUpdatedData
    : never;

export class EventDispatch<TType extends TopicName> {
  private options: EnvelopeOptions = {};

  constructor(
    private readonly publisher: EventPublisher,
    private readonly topic: TType,
    private readonly key: string,
    private readonly data: PayloadOf<TType>,
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

  async publish(): Promise<EventEnvelope<TType, PayloadOf<TType>>> {
    const envelope = createEnvelope(this.topic, this.data, this.options);
    await this.publisher.publish({ topic: this.topic, key: this.key, envelope });
    return envelope;
  }
}

class KeyedEvent<TType extends TopicName> {
  constructor(
    private readonly publisher: EventPublisher,
    private readonly topic: TType,
    private readonly key: string,
  ) {}

  with(data: PayloadOf<TType>): EventDispatch<TType> {
    return new EventDispatch(this.publisher, this.topic, this.key, data);
  }
}

class EventDraft<TType extends TopicName> {
  constructor(
    private readonly publisher: EventPublisher,
    private readonly topic: TType,
  ) {}

  keyedBy(key: string): KeyedEvent<TType> {
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
    event<TType extends TopicName>(topic: TType): EventDraft<TType> {
      return new EventDraft(publisher, topic);
    },
  };
}
