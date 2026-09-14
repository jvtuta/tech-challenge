import {
  TRANSACTION_SORT_FIELDS,
  TRANSACTION_STATUS,
  type ListTransactionsQuery,
  type SortDirection,
  type TransactionSortField,
  type TransactionStatus,
} from '@tech-challenge/contracts';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsPositive, Max, Min } from 'class-validator';

export const MAX_PAGE_SIZE = 100;

/** Formato dos filtros, da página e da ordenação; o read model aplica o que vier preenchido. */
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

  @IsOptional()
  @IsIn(TRANSACTION_SORT_FIELDS)
  sort?: TransactionSortField;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: SortDirection;
}
