import { Injectable } from '@nestjs/common';
import type { TransactionStatus } from '@tech-challenge/contracts';
import { Prisma, type Transaction as TransactionRow } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { UnknownTransferTypeError } from '../../application/errors';
import { Transaction } from '../../domain/transaction';
import type {
  PersistenceContext,
  TransactionRepository,
} from '../../domain/transaction.repository';
import { TransactionValue } from '../../domain/transaction-value.vo';
import { prismaClientOf } from '../../../shared/infrastructure/prisma/prisma-unit-of-work';

const FOREIGN_KEY_VIOLATION = 'P2003';

@Injectable()
export class PrismaTransactionRepository implements TransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(transaction: Transaction, context: PersistenceContext): Promise<void> {
    try {
      await prismaClientOf(context).transaction.create({
        data: {
          transactionExternalId: transaction.transactionExternalId,
          accountExternalIdDebit: transaction.accountExternalIdDebit,
          accountExternalIdCredit: transaction.accountExternalIdCredit,
          transferTypeId: transaction.transferTypeId,
          value: new Prisma.Decimal(transaction.value),
          status: transaction.status,
          createdAt: transaction.createdAt,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === FOREIGN_KEY_VIOLATION
      ) {
        throw new UnknownTransferTypeError(transaction.transferTypeId);
      }
      throw error;
    }
  }

  async findByExternalId(transactionExternalId: string): Promise<Transaction | null> {
    const row = await this.prisma.transaction.findUnique({ where: { transactionExternalId } });
    return row ? toDomain(row) : null;
  }
}

function toDomain(row: TransactionRow): Transaction {
  return Transaction.restore({
    transactionExternalId: row.transactionExternalId,
    accountExternalIdDebit: row.accountExternalIdDebit,
    accountExternalIdCredit: row.accountExternalIdCredit,
    transferTypeId: row.transferTypeId,
    value: TransactionValue.of(row.value.toNumber()),
    status: row.status as TransactionStatus,
    createdAt: row.createdAt,
  });
}
