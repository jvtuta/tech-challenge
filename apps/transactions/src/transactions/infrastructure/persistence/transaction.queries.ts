import { Injectable } from '@nestjs/common';
import type {
  ListTransactionsQuery,
  TransactionListResponse,
  TransactionResponse,
  TransactionStatus,
} from '@tech-challenge/contracts';
import type { Prisma, Transaction, TransactionType } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';

export const DEFAULT_PAGE_SIZE = 20;

type TransactionRow = Transaction & { transferType: Pick<TransactionType, 'name'> };

/**
 * Lado de leitura: devolve direto no contrato HTTP, sem hidratar a entidade. As regras de
 * negócio vivem nos casos de uso de escrita; aqui só existe consulta.
 */
@Injectable()
export class TransactionQueries {
  constructor(private readonly prisma: PrismaService) {}

  async findByExternalId(transactionExternalId: string): Promise<TransactionResponse | null> {
    const row = await this.prisma.transaction.findUnique({
      where: { transactionExternalId },
      include: { transferType: { select: { name: true } } },
    });
    return row ? toResponse(row) : null;
  }

  /** Página mais recente primeiro; `total` vem da mesma transação para a contagem bater com a página. */
  async list(query: ListTransactionsQuery): Promise<TransactionListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where: Prisma.TransactionWhereInput = {
      status: query.status,
      transferTypeId: query.transferTypeId,
      createdAt: query.from || query.to ? { gte: query.from, lte: query.to } : undefined,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        include: { transferType: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return { items: rows.map(toResponse), page, pageSize, total };
  }
}

function toResponse(row: TransactionRow): TransactionResponse {
  return {
    transactionExternalId: row.transactionExternalId,
    transactionType: { name: row.transferType.name },
    transactionStatus: { name: row.status as TransactionStatus },
    value: row.value.toNumber(),
    createdAt: row.createdAt.toISOString(),
  };
}
