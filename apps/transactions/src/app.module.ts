import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [PrismaModule, TransactionsModule],
  controllers: [HealthController],
})
export class AppModule {}
