import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWork } from '../../shared/application/unit-of-work';
import type { FinalStatus } from '../domain/transaction';
import { TransactionAlreadySettledError } from '../domain/transaction-settled.error';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepository,
} from '../domain/transaction.repository';
import { TransactionNotFoundError } from './errors';

export interface StatusUpdate {
  transactionExternalId: string;
  status: FinalStatus;
}

@Injectable()
export class UpdateTransactionStatus {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactions: TransactionRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  /**
   * Devolve `true` quando o status mudou e `false` quando o veredito já estava aplicado.
   *
   * Não lê para decidir: a decisão é a própria escrita condicional. Ler, avaliar em memória e
   * gravar pelo id deixava duas execuções concorrentes passarem as duas, e a última vencia; o
   * `where` da escrita faz o banco aceitar só uma.
   */
  async execute({ transactionExternalId, status }: StatusUpdate): Promise<boolean> {
    const result = await this.unitOfWork.run((context) =>
      this.transactions.settle(transactionExternalId, status, context),
    );
    switch (result) {
      case 'settled':
        return true;
      case 'duplicate':
        return false;
      case 'not-found':
        throw new TransactionNotFoundError(transactionExternalId);
      case 'conflict':
        throw new TransactionAlreadySettledError(transactionExternalId, status);
    }
  }
}
