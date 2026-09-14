import { Module } from '@nestjs/common';
import { MessagingModule } from '../shared/infrastructure/messaging/messaging.module';
import { CreateTransaction } from './application/create-transaction.use-case';
import { TRANSACTION_REPOSITORY } from './domain/transaction.repository';
import { TransactionsController } from './infrastructure/http/transactions.controller';
import { PrismaTransactionRepository } from './infrastructure/persistence/prisma-transaction.repository';
import { TransactionQueries } from './infrastructure/persistence/transaction.queries';

@Module({
  imports: [MessagingModule],
  controllers: [TransactionsController],
  providers: [
    CreateTransaction,
    TransactionQueries,
    { provide: TRANSACTION_REPOSITORY, useClass: PrismaTransactionRepository },
  ],
})
export class TransactionsModule {}
