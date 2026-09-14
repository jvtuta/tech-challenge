import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { AntiFraudModule } from './anti-fraud/anti-fraud.module';
import { HealthController } from './health/health.controller';
import { EnvConfigModule } from './shared/infrastructure/env-config/env-config.module';

@Module({
  imports: [EnvConfigModule.forRoot(), TerminusModule, AntiFraudModule],
  controllers: [HealthController],
})
export class AppModule {}
