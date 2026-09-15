'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateTransactionRequest,
  ListTransactionsQuery,
  TransactionListResponse,
  TransactionResponse,
} from '@tech-challenge/contracts';
import { createTransaction, getTransaction, listTransactions, subscribeToStatus } from './api';

export const transactionKeys = {
  list: (query: ListTransactionsQuery) => ['transactions', 'list', query] as const,
  detail: (id: string) => ['transactions', 'detail', id] as const,
};

/**
 * Intervalo entre reconsultas da listagem, usado só enquanto há pendente na página visível.
 * Não é a latência esperada do veredito, que chega em dezenas de milissegundos: é o teto do
 * caso raro, o do broker que recusou a publicação e cuja recuperação depende do varredor
 * (carência de 10 s mais o intervalo de 5 s da passada). Dois segundos mantêm a tela viva sem
 * passar de trinta requisições por minuto por aba aberta.
 */
export const LIST_POLL_INTERVAL_MS = 2_000;

const hasPendingItem = (data: TransactionListResponse | undefined): boolean =>
  data?.items.some((item) => item.transactionStatus.name === 'pending') ?? false;

export function useTransactions(query: ListTransactionsQuery) {
  return useQuery({
    queryKey: transactionKeys.list(query),
    queryFn: () => listTransactions(query),
    // Reconsulta a página inteira, e não o status de uma linha: quando o veredito chega, a
    // linha pode deixar de casar com o filtro e o total muda junto. Para sozinha quando não
    // há mais pendente à vista, e o React Query limpa o timer ao desmontar.
    refetchInterval: ({ state }) => (hasPendingItem(state.data) ? LIST_POLL_INTERVAL_MS : false),
  });
}

export function useTransaction(transactionExternalId: string) {
  return useQuery({
    queryKey: transactionKeys.detail(transactionExternalId),
    queryFn: () => getTransaction(transactionExternalId),
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTransactionRequest) => createTransaction(body),
    onSuccess: (created) => {
      queryClient.setQueryData(transactionKeys.detail(created.transactionExternalId), created);
      void queryClient.invalidateQueries({ queryKey: ['transactions', 'list'] });
    },
  });
}

/** Só assina o stream enquanto a transação está pendente; ao mudar, atualiza o cache e solta. */
export function useStatusStream(transaction: TransactionResponse | undefined) {
  const queryClient = useQueryClient();
  const id = transaction?.transactionExternalId;
  const pending = transaction?.transactionStatus.name === 'pending';
  useEffect(() => {
    if (!id || !pending) {
      return;
    }
    return subscribeToStatus(
      id,
      (change) => {
        queryClient.setQueryData<TransactionResponse>(transactionKeys.detail(id), (current) =>
          current ? { ...current, transactionStatus: { name: change.status } } : current,
        );
        void queryClient.invalidateQueries({ queryKey: ['transactions', 'list'] });
      },
      // O navegador reconecta sozinho e a primeira mensagem da conexão nova é o estado atual;
      // consultar agora encurta a espera e reconcilia a tela com o banco sem depender disso.
      () => void queryClient.invalidateQueries({ queryKey: transactionKeys.detail(id) }),
    );
  }, [id, pending, queryClient]);
}
