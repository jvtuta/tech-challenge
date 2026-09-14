'use client';

import Link from 'next/link';
import { useStatusStream, useTransaction } from '../hooks';
import { StatusBadge } from './status-badge';
import { formatCurrency, formatDateTime } from '@/shared/lib/format';
import { ErrorState, LoadingState } from '@/shared/ui/states';

export function TransactionDetail({ transactionExternalId }: { transactionExternalId: string }) {
  const query = useTransaction(transactionExternalId);
  useStatusStream(query.data);

  if (query.isPending) {
    return <LoadingState label="Carregando transação" />;
  }
  if (query.isError) {
    return <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />;
  }
  const transaction = query.data;
  const pending = transaction.transactionStatus.name === 'pending';

  return (
    <article className="flex flex-col gap-4">
      <Link href="/" className="text-sm underline">
        Voltar para a listagem
      </Link>
      <h1 className="text-2xl font-semibold">Transação</h1>
      <dl className="grid grid-cols-1 gap-3 rounded border border-zinc-200 bg-white p-4 text-sm md:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Identificador</dt>
          <dd className="font-mono">{transaction.transactionExternalId}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Status</dt>
          <dd>
            <StatusBadge status={transaction.transactionStatus.name} />
            {pending ? (
              <span role="status" className="ml-2 text-xs text-zinc-500">
                aguardando o antifraude
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Tipo</dt>
          <dd>{transaction.transactionType.name}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Valor</dt>
          <dd className="tabular-nums">{formatCurrency(transaction.value)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Criada em</dt>
          <dd>{formatDateTime(transaction.createdAt)}</dd>
        </div>
      </dl>
    </article>
  );
}
