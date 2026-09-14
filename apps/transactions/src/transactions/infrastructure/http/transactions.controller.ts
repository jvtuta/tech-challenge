import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type { TransactionResponse } from '@tech-challenge/contracts';
import { CreateTransaction } from '../../application/create-transaction.use-case';
import { TransactionNotFoundError } from '../../application/errors';
import { TransactionQueries } from '../persistence/transaction.queries';
import { CreateTransactionDto } from './create-transaction.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly createTransaction: CreateTransaction,
    private readonly queries: TransactionQueries,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: CreateTransactionDto): Promise<TransactionResponse> {
    const { transactionExternalId } = await this.createTransaction.execute(body);
    // A leitura devolve o contrato completo (nome do tipo incluído) sem duplicar o mapeamento.
    const created = await this.queries.findByExternalId(transactionExternalId);
    if (!created) {
      throw new Error(`Transaction ${transactionExternalId} vanished right after being created`);
    }
    return created;
  }

  @Get(':transactionExternalId')
  async findOne(
    @Param('transactionExternalId', ParseUUIDPipe) transactionExternalId: string,
  ): Promise<TransactionResponse> {
    const transaction = await this.queries.findByExternalId(transactionExternalId);
    if (!transaction) {
      throw new TransactionNotFoundError(transactionExternalId);
    }
    return transaction;
  }
}
