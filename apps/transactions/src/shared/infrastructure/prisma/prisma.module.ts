import { Global, Module } from '@nestjs/common';
import { UNIT_OF_WORK } from '../../application/unit-of-work';
import { PrismaUnitOfWork } from './prisma-unit-of-work';
import { PrismaService } from './prisma.service';

/** Global: qualquer módulo injeta o `PrismaService` e a `UNIT_OF_WORK` sem reimportar. */
@Global()
@Module({
  providers: [PrismaService, { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork }],
  exports: [PrismaService, UNIT_OF_WORK],
})
export class PrismaModule {}
