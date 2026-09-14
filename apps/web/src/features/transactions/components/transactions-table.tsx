import Link from 'next/link';
import type { TransactionResponse } from '@tech-challenge/contracts';
import { formatCurrency, formatDateTime } from '@/shared/lib/format';
import { StatusBadge } from './status-badge';

export function TransactionsTable({ items }: { items: TransactionResponse[] }) {
  return (
    <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
          <tr>
            <th scope="col" className="px-4 py-3">
              Transação
            </th>
            <th scope="col" className="px-4 py-3">
              Tipo
            </th>
            <th scope="col" className="px-4 py-3">
              Status
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Valor
            </th>
            <th scope="col" className="px-4 py-3">
              Criada em
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((transaction) => (
            <tr key={transaction.transactionExternalId} className="border-t border-zinc-100">
              <td className="px-4 py-3 font-mono text-xs">
                <Link
                  href={`/transactions/${transaction.transactionExternalId}`}
                  className="underline"
                >
                  {transaction.transactionExternalId.slice(0, 8)}
                </Link>
              </td>
              <td className="px-4 py-3">{transaction.transactionType.name}</td>
              <td className="px-4 py-3">
                <StatusBadge status={transaction.transactionStatus.name} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatCurrency(transaction.value)}
              </td>
              <td className="px-4 py-3 text-zinc-600">{formatDateTime(transaction.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
