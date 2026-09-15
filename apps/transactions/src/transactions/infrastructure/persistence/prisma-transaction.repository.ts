import { Injectable } from '@nestjs/common';
import { TRANSACTION_STATUS, type TransactionStatus } from '@tech-challenge/contracts';
import { Prisma, type Transaction as TransactionRow } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { UnknownTransferTypeError } from '../../application/errors';
import { Transaction, type FinalStatus } from '../../domain/transaction';
import { settleOutcome } from '../../domain/settle-outcome';
import type {
  PersistenceContext,
  SettleResult,
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

  /**
   * A guarda da transição é o `where`, não uma leitura anterior: o `UPDATE` só casa se a
   * linha ainda estiver pendente, então duas execuções concorrentes do mesmo veredito
   * resultam em uma transição, e de vereditos opostos sobra um. `updateMany` e não `update`
   * porque zero linhas afetadas aqui é resposta, não exceção: `update` lançaria `P2025`, que
   * não é erro de negócio e o filter do consumer reentregaria três vezes antes de desistir.
   */
  async settle(
    transactionExternalId: string,
    status: FinalStatus,
    context: PersistenceContext,
  ): Promise<SettleResult> {
    const client = prismaClientOf(context);
    const { count } = await client.transaction.updateMany({
      where: { transactionExternalId, status: TRANSACTION_STATUS.PENDING },
      data: { status },
    });
    if (count > 0) {
      return 'settled';
    }
    // Não casou: ou a linha nunca existiu, ou alguém chegou primeiro. Quem responde qual dos
    // dois é a leitura, no mesmo contexto, e disso depende o destino da mensagem no consumer.
    const row = await client.transaction.findUnique({
      where: { transactionExternalId },
      select: { status: true },
    });
    return row ? settleOutcome(row.status, status) : 'not-found';
  }

  async findByExternalId(transactionExternalId: string): Promise<Transaction | null> {
    const row = await this.prisma.transaction.findUnique({ where: { transactionExternalId } });
    return row ? toDomain(row) : null;
  }

  async findPendingOlderThan(cutoff: Date, limit: number): Promise<Transaction[]> {
    const rows = await this.prisma.transaction.findMany({
      where: { status: TRANSACTION_STATUS.PENDING, createdAt: { lt: cutoff } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map(toDomain);
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
