import { randomUUID } from 'node:crypto';
import { TRANSACTION_STATUS, type TransactionStatus } from '@tech-challenge/contracts';
import { TransactionValue } from './transaction-value';

export interface NewTransaction {
  accountExternalIdDebit: string;
  accountExternalIdCredit: string;
  transferTypeId: number;
  value: number;
}

export interface TransactionProps {
  transactionExternalId: string;
  accountExternalIdDebit: string;
  accountExternalIdCredit: string;
  transferTypeId: number;
  value: TransactionValue;
  status: TransactionStatus;
  createdAt: Date;
}

export class Transaction {
  private constructor(private readonly props: TransactionProps) {}

  /** Toda transação nasce pendente; só o antifraude muda o status, de forma assíncrona. */
  static create(input: NewTransaction, now: Date = new Date()): Transaction {
    return new Transaction({
      transactionExternalId: randomUUID(),
      accountExternalIdDebit: input.accountExternalIdDebit,
      accountExternalIdCredit: input.accountExternalIdCredit,
      transferTypeId: input.transferTypeId,
      value: TransactionValue.of(input.value),
      status: TRANSACTION_STATUS.PENDING,
      createdAt: now,
    });
  }

  static restore(props: TransactionProps): Transaction {
    return new Transaction(props);
  }

  get transactionExternalId(): string {
    return this.props.transactionExternalId;
  }

  get accountExternalIdDebit(): string {
    return this.props.accountExternalIdDebit;
  }

  get accountExternalIdCredit(): string {
    return this.props.accountExternalIdCredit;
  }

  get transferTypeId(): number {
    return this.props.transferTypeId;
  }

  get value(): number {
    return this.props.value.toNumber();
  }

  get status(): TransactionStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
