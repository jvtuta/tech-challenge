import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { TransactionListResponse, TransactionResponse } from '@tech-challenge/contracts';
import { SearchParams } from '../../../shared/domain/searchable-repository';
import { CreateTransaction } from '../../application/create-transaction.use-case';
import { TransactionNotFoundError } from '../../application/errors';
import { TransactionQueries } from '../persistence/transaction.queries';
import { CreateTransactionDto } from './create-transaction.dto';
import { ListTransactionsDto } from './list-transactions.dto';

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
    // Depois de gravar, a resposta vem do lado de leitura: é o read model que conhece o
    // contrato completo (nome do tipo incluído), e assim o mapeamento existe uma vez só, no
    // mesmo caminho que o GET usa. Se a leitura não achar o que acabou de ser gravado, é o
    // mesmo erro de negócio da consulta, traduzido na borda como os demais.
    const created = await this.queries.findByExternalId(transactionExternalId);
    if (!created) {
      throw new TransactionNotFoundError(transactionExternalId);
    }
    return created;
  }

  @Get()
  async list(@Query() query: ListTransactionsDto): Promise<TransactionListResponse> {
    const { page, pageSize, sort, sortDir, ...filter } = query;
    const result = await this.queries.search(
      new SearchParams({ page, perPage: pageSize, sort, sortDir, filter }),
    );
    return {
      items: result.items,
      page: result.currentPage,
      pageSize: result.perPage,
      total: result.total,
    };
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
