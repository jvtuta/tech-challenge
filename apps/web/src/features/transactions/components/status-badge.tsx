import type { TransactionStatus } from '@tech-challenge/contracts';

const labels: Record<TransactionStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
};

const styles: Record<TransactionStatus, string> = {
  pending: 'bg-amber-100 text-amber-900',
  approved: 'bg-emerald-100 text-emerald-900',
  rejected: 'bg-red-100 text-red-900',
};

export function StatusBadge({ status }: { status: TransactionStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export const statusLabel = (status: TransactionStatus): string => labels[status];
