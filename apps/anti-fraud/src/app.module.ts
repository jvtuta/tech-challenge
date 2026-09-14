import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { EnvConfigModule } from './shared/infrastructure/env-config/env-config.module';

@Module({
  imports: [EnvConfigModule.forRoot()],
  controllers: [HealthController],
})
export class AppModule {}
