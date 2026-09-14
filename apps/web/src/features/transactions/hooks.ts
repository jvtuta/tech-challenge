'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateTransactionRequest,
  ListTransactionsQuery,
  TransactionResponse,
} from '@tech-challenge/contracts';
import { createTransaction, getTransaction, listTransactions, subscribeToStatus } from './api';

export const transactionKeys = {
  list: (query: ListTransactionsQuery) => ['transactions', 'list', query] as const,
  detail: (id: string) => ['transactions', 'detail', id] as const,
};

export function useTransactions(query: ListTransactionsQuery) {
  return useQuery({
    queryKey: transactionKeys.list(query),
    queryFn: () => listTransactions(query),
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
    return subscribeToStatus(id, (change) => {
      queryClient.setQueryData<TransactionResponse>(transactionKeys.detail(id), (current) =>
        current ? { ...current, transactionStatus: { name: change.status } } : current,
      );
      void queryClient.invalidateQueries({ queryKey: ['transactions', 'list'] });
    });
  }, [id, pending, queryClient]);
}
