import { Injectable } from '@nestjs/common';
import type { TransactionResponse, TransactionStatus } from '@tech-challenge/contracts';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';

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
    if (!row) {
      return null;
    }
    return {
      transactionExternalId: row.transactionExternalId,
      transactionType: { name: row.transferType.name },
      transactionStatus: { name: row.status as TransactionStatus },
      value: row.value.toNumber(),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
