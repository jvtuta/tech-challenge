import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { EnvConfigModule } from './shared/infrastructure/env-config/env-config.module';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [EnvConfigModule.forRoot(), PrismaModule, TransactionsModule],
  controllers: [HealthController],
})
export class AppModule {}
