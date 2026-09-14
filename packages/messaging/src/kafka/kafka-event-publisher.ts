import { Kafka, type Producer } from 'kafkajs';
import type { EventPublisher, OutboundEvent } from '../event-publisher.port';

export interface KafkaEventPublisherOptions {
  brokers: string[];
  clientId: string;
}

/**
 * Adapter KafkaJS da porta de publicação. Conecta na primeira publicação, para que o serviço
 * suba sem o broker e só falhe (com erro tratável) quando de fato precisar dele.
 */
export class KafkaEventPublisher implements EventPublisher {
  private readonly producer: Producer;
  private connecting: Promise<void> | undefined;

  constructor(options: KafkaEventPublisherOptions) {
    const kafka = new Kafka({ brokers: options.brokers, clientId: options.clientId });
    this.producer = kafka.producer({ allowAutoTopicCreation: true });
  }

  async publish(event: OutboundEvent): Promise<void> {
    await this.ensureConnected();
    await this.producer.send({
      topic: event.topic,
      messages: [{ key: event.key, value: JSON.stringify(event.envelope) }],
    });
  }

  async disconnect(): Promise<void> {
    if (this.connecting) {
      await this.producer.disconnect();
      this.connecting = undefined;
    }
  }

  private ensureConnected(): Promise<void> {
    this.connecting ??= this.producer.connect().catch((error: unknown) => {
      this.connecting = undefined;
      throw error;
    });
    return this.connecting;
  }
}
