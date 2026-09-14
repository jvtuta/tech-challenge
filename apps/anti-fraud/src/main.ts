import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { EnvConfigService } from './shared/infrastructure/env-config/env-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  await app.listen(app.get(EnvConfigService).getPort());
}

void bootstrap();
