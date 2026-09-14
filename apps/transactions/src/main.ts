import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DomainErrorFilter } from './shared/infrastructure/http/domain-error.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new DomainErrorFilter());
  const port = Number(process.env.TRANSACTIONS_PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
