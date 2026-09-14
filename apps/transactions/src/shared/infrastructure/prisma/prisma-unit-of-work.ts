import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PersistenceContext, UnitOfWork } from '../../application/unit-of-work';
import { PrismaService } from './prisma.service';

/** O contexto de persistência do Prisma é o cliente transacional do `$transaction`. */
export interface PrismaPersistenceContext extends PersistenceContext {
  readonly client: Prisma.TransactionClient;
}

export function prismaClientOf(context: PersistenceContext): Prisma.TransactionClient {
  return (context as PrismaPersistenceContext).client;
}

@Injectable()
export class PrismaUnitOfWork implements UnitOfWork<PrismaPersistenceContext> {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(work: (context: PrismaPersistenceContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((client) => work({ kind: 'persistence-context', client }));
  }
}
