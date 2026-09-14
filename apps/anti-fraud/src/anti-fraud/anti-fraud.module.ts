import { Module } from '@nestjs/common';
import { MessagingModule } from '../shared/infrastructure/messaging/messaging.module';
import { TransactionCreatedController } from './infrastructure/transaction-created.controller';

@Module({
  imports: [MessagingModule],
  controllers: [TransactionCreatedController],
})
export class AntiFraudModule {}
