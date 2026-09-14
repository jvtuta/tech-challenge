import { Module } from '@nestjs/common';
import { MessagingModule } from '../shared/infrastructure/messaging/messaging.module';
import { CreateTransaction } from './application/create-transaction.use-case';
import { UpdateTransactionStatus } from './application/update-transaction-status.use-case';
import { TRANSACTION_REPOSITORY } from './domain/transaction.repository';
import { TransactionsController } from './infrastructure/http/transactions.controller';
import { TransactionStatusUpdatedController } from './infrastructure/kafka/transaction-status-updated.controller';
import { PrismaTransactionRepository } from './infrastructure/persistence/prisma-transaction.repository';
import { TransactionQueries } from './infrastructure/persistence/transaction.queries';

@Module({
  imports: [MessagingModule],
  controllers: [TransactionsController, TransactionStatusUpdatedController],
  providers: [
    CreateTransaction,
    UpdateTransactionStatus,
    TransactionQueries,
    { provide: TRANSACTION_REPOSITORY, useClass: PrismaTransactionRepository },
  ],
})
export class TransactionsModule {}
