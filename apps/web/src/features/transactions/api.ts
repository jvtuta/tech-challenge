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

/**
 * Assina o stream de status; o servidor fecha quando a transação deixa de ser pendente.
 *
 * O `EventSource` reconecta sozinho quando a conexão cai, e a reconciliação vem do próprio
 * servidor: a primeira mensagem de uma conexão nova é sempre o estado atual. O que sobra para
 * o cliente é não derrubar a tela no caminho: uma mensagem que não parseia é descartada com
 * aviso, em vez de estourar dentro de um callback de evento do DOM, fora do boundary do React.
 */
export function subscribeToStatus(
  transactionExternalId: string,
  onChange: (change: StatusChange) => void,
  onConnectionError?: () => void,
): () => void {
  const source = new EventSource(apiUrl(`/transactions/${transactionExternalId}/events`));
  source.addEventListener('status', (event) => {
    try {
      onChange(JSON.parse((event as MessageEvent<string>).data) as StatusChange);
    } catch {
      console.warn(`Discarding a status message outside the contract for ${transactionExternalId}`);
    }
  });
  source.addEventListener('error', () => {
    onConnectionError?.();
  });
  return () => source.close();
}
