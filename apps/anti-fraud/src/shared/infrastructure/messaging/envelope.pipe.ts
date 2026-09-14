import { Injectable, type PipeTransform } from '@nestjs/common';
import type { TopicName, TransactionEvent } from '@tech-challenge/contracts';
import { parseEnvelope } from '@tech-challenge/messaging';

export class MalformedEventError extends Error {
  constructor(readonly topic: TopicName) {
    super(`Message outside the event contract of ${topic}`);
    this.name = 'MalformedEventError';
  }
}

/** Entrega ao handler só um envelope válido do tópico dele; o resto vira `MalformedEventError`. */
@Injectable()
export class EnvelopePipe<TTopic extends TopicName> implements PipeTransform<
  unknown,
  TransactionEvent
> {
  constructor(private readonly topic: TTopic) {}

  static of<TTopic extends TopicName>(topic: TTopic): EnvelopePipe<TTopic> {
    return new EnvelopePipe(topic);
  }

  transform(value: unknown): Extract<TransactionEvent, { eventType: TTopic }> {
    const envelope = parseEnvelope(value);
    if (envelope?.eventType !== this.topic) {
      throw new MalformedEventError(this.topic);
    }
    return envelope as Extract<TransactionEvent, { eventType: TTopic }>;
  }
}
