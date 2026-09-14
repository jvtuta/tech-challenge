import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { DomainErrorFilter } from './shared/infrastructure/http/domain-error.filter';

/** Mesma configuração de borda em produção e nos testes de ponta a ponta. */
export function configureApp(app: INestApplication): INestApplication {
  // O dashboard roda em outra origem; sem autenticação neste recorte, qualquer origem pode ler.
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new DomainErrorFilter());
  return app;
}
