import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import type { UnitOfWork } from '../../application/unit-of-work';
import type { PersistenceContext } from '../../domain/transaction.repository';

/** O contexto de persistência do Prisma é o cliente transacional do `$transaction`. */
export interface PrismaPersistenceContext extends PersistenceContext {
  readonly client: Prisma.TransactionClient;
}

export function prismaClientOf(context: PersistenceContext): Prisma.TransactionClient {
  return (context as PrismaPersistenceContext).client;
}

@Injectable()
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(work: (context: PersistenceContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((client) => {
      const context: PrismaPersistenceContext = { kind: 'persistence-context', client };
      return work(context);
    });
  }
}
