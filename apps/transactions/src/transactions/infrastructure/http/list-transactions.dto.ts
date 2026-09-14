import {
  TRANSACTION_STATUS,
  type ListTransactionsQuery,
  type TransactionStatus,
} from '@tech-challenge/contracts';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsPositive, Max, Min } from 'class-validator';

export const MAX_PAGE_SIZE = 100;

/** Formato dos filtros; o read model aplica os que vierem preenchidos. */
export class ListTransactionsDto implements ListTransactionsQuery {
  @IsOptional()
  @IsIn(Object.values(TRANSACTION_STATUS))
  status?: TransactionStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  transferTypeId?: number;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number;
}
