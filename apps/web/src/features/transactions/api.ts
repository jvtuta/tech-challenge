import type {
  CreateTransactionRequest,
  ListTransactionsQuery,
  TransactionListResponse,
  TransactionResponse,
  TransactionStatus,
} from '@tech-challenge/contracts';
import { apiUrl, fetchJson } from '@/shared/lib/api';

export function listTransactions(query: ListTransactionsQuery): Promise<TransactionListResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }
  const search = params.toString();
  return fetchJson(`/transactions${search ? `?${search}` : ''}`);
}

export function getTransaction(transactionExternalId: string): Promise<TransactionResponse> {
  return fetchJson(`/transactions/${transactionExternalId}`);
}

export function createTransaction(body: CreateTransactionRequest): Promise<TransactionResponse> {
  return fetchJson('/transactions', { method: 'POST', body: JSON.stringify(body) });
}

export interface StatusChange {
  transactionExternalId: string;
  status: TransactionStatus;
}

/** Assina o stream de status; o servidor fecha quando a transação deixa de ser pendente. */
export function subscribeToStatus(
  transactionExternalId: string,
  onChange: (change: StatusChange) => void,
): () => void {
  const source = new EventSource(apiUrl(`/transactions/${transactionExternalId}/events`));
  source.addEventListener('status', (event) => {
    onChange(JSON.parse((event as MessageEvent<string>).data) as StatusChange);
  });
  return () => source.close();
}
