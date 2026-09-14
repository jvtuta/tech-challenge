import { type MicroserviceOptions, Transport } from '@nestjs/microservices';
import type { EnvConfigService } from '../env-config/env-config.service';

/** Opções do transporte Kafka do NestJS, lidas do ambiente; usadas no boot e nos testes. */
export function kafkaMicroserviceOptions(envConfig: EnvConfigService): MicroserviceOptions {
  return {
    transport: Transport.KAFKA,
    options: {
      client: { brokers: envConfig.getKafkaBrokers(), clientId: envConfig.getKafkaClientId() },
      consumer: { groupId: envConfig.getKafkaGroupId() },
      subscribe: { fromBeginning: true },
    },
  };
}
