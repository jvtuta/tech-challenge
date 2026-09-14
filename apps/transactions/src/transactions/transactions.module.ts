import { Module } from '@nestjs/common';
import { MessagingModule } from '../shared/infrastructure/messaging/messaging.module';
import { UNIT_OF_WORK } from './application/unit-of-work';
import { CreateTransaction } from './application/create-transaction.use-case';
import { TRANSACTION_REPOSITORY } from './domain/transaction.repository';
import { TransactionsController } from './infrastructure/http/transactions.controller';
import { PrismaTransactionRepository } from './infrastructure/persistence/prisma-transaction.repository';
import { PrismaUnitOfWork } from './infrastructure/persistence/prisma-unit-of-work';
import { TransactionQueries } from './infrastructure/persistence/transaction.queries';

@Module({
  imports: [MessagingModule],
  controllers: [TransactionsController],
  providers: [
    CreateTransaction,
    TransactionQueries,
    { provide: TRANSACTION_REPOSITORY, useClass: PrismaTransactionRepository },
    { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
  ],
})
export class TransactionsModule {}
