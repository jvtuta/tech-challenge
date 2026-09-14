import type { EventPublisher, OutboundEvent } from '../event-publisher.port';

/** Publisher para testes: guarda o que foi publicado e, se pedido, simula falha do broker. */
export class InMemoryEventPublisher implements EventPublisher {
  readonly published: OutboundEvent[] = [];
  private failure: Error | undefined;

  failWith(error: Error): this {
    this.failure = error;
    return this;
  }

  async publish(event: OutboundEvent): Promise<void> {
    if (this.failure) {
      throw this.failure;
    }
    this.published.push(event);
  }

  lastPublished(): OutboundEvent | undefined {
    return this.published[this.published.length - 1];
  }
}
