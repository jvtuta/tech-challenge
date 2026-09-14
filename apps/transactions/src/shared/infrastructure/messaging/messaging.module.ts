import { Module, type OnModuleDestroy } from '@nestjs/common';
import { EVENT_PUBLISHER, KafkaEventPublisher } from '@tech-challenge/messaging';
import { EnvConfigService } from '../env-config/env-config.service';

/** Liga o ciclo de vida do NestJS ao producer sem levar o NestJS para dentro do pacote. */
class NestKafkaEventPublisher extends KafkaEventPublisher implements OnModuleDestroy {
  onModuleDestroy(): Promise<void> {
    return this.disconnect();
  }
}

@Module({
  providers: [
    {
      provide: EVENT_PUBLISHER,
      useFactory: (envConfig: EnvConfigService) =>
        new NestKafkaEventPublisher({
          brokers: envConfig.getKafkaBrokers(),
          clientId: envConfig.getKafkaClientId(),
        }),
      inject: [EnvConfigService],
    },
  ],
  exports: [EVENT_PUBLISHER],
})
export class MessagingModule {}
