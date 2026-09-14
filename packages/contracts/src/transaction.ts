export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type TransactionStatus = (typeof TRANSACTION_STATUS)[keyof typeof TRANSACTION_STATUS];

/**
 * Tipos de transferência conhecidos. O catálogo vive no banco (tabela `transaction_types`);
 * aqui ficam os identificadores estáveis usados pelo contrato HTTP e pelos eventos.
 */
export const TRANSFER_TYPE = {
  TRANSFER: 1,
  PAYMENT: 2,
  WITHDRAWAL: 3,
} as const;

export type TransferTypeId = (typeof TRANSFER_TYPE)[keyof typeof TRANSFER_TYPE];

/** Corpo de `POST /transactions`, conforme o enunciado. */
export interface CreateTransactionRequest {
  accountExternalIdDebit: string;
  accountExternalIdCredit: string;
  transferTypeId: number;
  value: number;
}

/** Resposta de `GET /transactions/:transactionExternalId`, conforme o enunciado. */
export interface TransactionResponse {
  transactionExternalId: string;
  transactionType: { name: string };
  transactionStatus: { name: TransactionStatus };
  value: number;
  createdAt: string;
}

/** Filtros e paginação de `GET /transactions`; datas em ISO-8601. */
export interface ListTransactionsQuery {
  status?: TransactionStatus;
  transferTypeId?: number;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface PagedResponse<TItem> {
  items: TItem[];
  page: number;
  pageSize: number;
  total: number;
}

export type TransactionListResponse = PagedResponse<TransactionResponse>;
