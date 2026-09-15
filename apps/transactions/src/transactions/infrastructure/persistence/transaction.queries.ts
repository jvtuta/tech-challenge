import { Injectable } from '@nestjs/common';
import {
  TRANSACTION_SORT_FIELDS,
  type TransactionFilter,
  type TransactionResponse,
  type TransactionStatus,
} from '@tech-challenge/contracts';
import type { Prisma, Transaction, TransactionType } from '@prisma/client';
import {
  SearchResult,
  type SearchParams,
  type SearchableRepository,
} from '../../../shared/domain/searchable-repository';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';

type TransactionRow = Transaction & { transferType: Pick<TransactionType, 'name'> };

/**
 * Lado de leitura: devolve direto no contrato HTTP, sem hidratar a entidade. As regras de
 * negócio vivem nos casos de uso de escrita; aqui só existe consulta.
 */
@Injectable()
export class TransactionQueries implements SearchableRepository<
  TransactionResponse,
  TransactionFilter
> {
  readonly sortableFields = TRANSACTION_SORT_FIELDS;

  constructor(private readonly prisma: PrismaService) {}

  async findByExternalId(transactionExternalId: string): Promise<TransactionResponse | null> {
    const row = await this.prisma.transaction.findUnique({
      where: { transactionExternalId },
      include: { transferType: { select: { name: true } } },
    });
    return row ? toResponse(row) : null;
  }

  /**
   * A página e o `total` saem do mesmo snapshot. Estar na mesma transação não basta: em
   * `READ COMMITTED`, o padrão do PostgreSQL, cada statement tira o seu próprio snapshot, e
   * uma escrita concorrente entre os dois desalinha a contagem. `REPEATABLE READ` fixa o
   * snapshot no primeiro statement, e como a transação é só de leitura não há erro de
   * serialização para tratar.
   */
  async search(
    params: SearchParams<TransactionFilter>,
  ): Promise<SearchResult<TransactionResponse, TransactionFilter>> {
    const where = toWhere(params.filter);
    const { rows, total } = await this.prisma.$transaction(
      async (client) => {
        const page = await client.transaction.findMany({
          where,
          include: { transferType: { select: { name: true } } },
          orderBy: toOrderBy(params, this.sortableFields),
          skip: (params.page - 1) * params.perPage,
          take: params.perPage,
        });
        return { rows: page, total: await client.transaction.count({ where }) };
      },
      { isolationLevel: 'RepeatableRead' },
    );
    return new SearchResult({ items: rows.map(toResponse), total, params });
  }
}

/** Só os filtros preenchidos entram na consulta; cada um casa com um índice composto da modelagem. */
export function toWhere(filter: TransactionFilter | null): Prisma.TransactionWhereInput {
  if (!filter) {
    return {};
  }
  return {
    status: filter.status,
    transferTypeId: filter.transferTypeId,
    createdAt: filter.from || filter.to ? { gte: filter.from, lte: filter.to } : undefined,
  };
}

/** Ordena pelo campo pedido quando ele é ordenável; fora isso, do mais recente para o mais antigo. */
export function toOrderBy(
  params: SearchParams<TransactionFilter>,
  sortableFields: readonly string[],
): Prisma.TransactionOrderByWithRelationInput {
  if (params.sort && params.sortDir && sortableFields.includes(params.sort)) {
    return { [params.sort]: params.sortDir };
  }
  return { createdAt: 'desc' };
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
