import { NestFactory } from '@nestjs/core';
import { TOPICS } from '@tech-challenge/contracts';
import { ensureTopics } from '@tech-challenge/messaging';
import { AppModule } from './app.module';
import { EnvConfigService } from './shared/infrastructure/env-config/env-config.service';
import { kafkaMicroserviceOptions } from './shared/infrastructure/messaging/kafka.options';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const envConfig = app.get(EnvConfigService);
  await ensureTopics(
    { brokers: envConfig.getKafkaBrokers(), clientId: envConfig.getKafkaClientId() },
    [TOPICS.TRANSACTION_CREATED, TOPICS.TRANSACTION_STATUS_UPDATED],
  );
  app.connectMicroservice(kafkaMicroserviceOptions(envConfig));
  await app.startAllMicroservices();
  await app.listen(envConfig.getPort());
}

void bootstrap();
