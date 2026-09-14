import { Module, type OnModuleDestroy } from '@nestjs/common';
import { EVENT_PUBLISHER, KafkaEventPublisher } from '@tech-challenge/messaging';

/** Liga o ciclo de vida do NestJS ao producer sem levar o NestJS para dentro do pacote. */
class NestKafkaEventPublisher extends KafkaEventPublisher implements OnModuleDestroy {
  onModuleDestroy(): Promise<void> {
    return this.disconnect();
  }
}

function kafkaPublisherFromEnv(): NestKafkaEventPublisher {
  const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');
  const clientId = process.env.KAFKA_CLIENT_ID ?? 'transactions';
  return new NestKafkaEventPublisher({ brokers, clientId });
}

@Module({
  providers: [{ provide: EVENT_PUBLISHER, useFactory: kafkaPublisherFromEnv }],
  exports: [EVENT_PUBLISHER],
})
export class MessagingModule {}
