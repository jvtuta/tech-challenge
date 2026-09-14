import type { CreateTransactionRequest } from '@tech-challenge/contracts';
import { IsInt, IsNumber, IsPositive, IsUUID } from 'class-validator';

/** Formato e presença dos campos; as regras de negócio ficam no domínio. */
export class CreateTransactionDto implements CreateTransactionRequest {
  @IsUUID()
  accountExternalIdDebit!: string;

  @IsUUID()
  accountExternalIdCredit!: string;

  @IsInt()
  @IsPositive()
  transferTypeId!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  value!: number;
}
