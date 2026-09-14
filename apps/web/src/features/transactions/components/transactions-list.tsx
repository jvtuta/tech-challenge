'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTransactions } from '../hooks';
import { Pagination } from './pagination';
import { TransactionsFilters, type Filters } from './transactions-filters';
import { TransactionsTable } from './transactions-table';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/states';

const PAGE_SIZE = 20;

export function TransactionsList() {
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const query = useTransactions({ ...filters, page, pageSize: PAGE_SIZE });

  const applyFilters = (next: Filters) => {
    setFilters(next);
    setPage(1);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transações</h1>
        <Link
          href="/transactions/new"
          className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
        >
          Nova transação
        </Link>
      </div>
      <TransactionsFilters value={filters} onChange={applyFilters} />
      {query.isPending ? (
        <LoadingState label="Carregando transações" />
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState title="Nenhuma transação encontrada">
          Ajuste os filtros ou crie uma nova transação.
        </EmptyState>
      ) : (
        <>
          <TransactionsTable items={query.data.items} />
          <Pagination
            page={query.data.page}
            pageSize={query.data.pageSize}
            total={query.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
}
