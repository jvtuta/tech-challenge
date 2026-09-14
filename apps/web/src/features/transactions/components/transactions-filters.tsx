'use client';

import { TRANSACTION_STATUS, type ListTransactionsQuery } from '@tech-challenge/contracts';
import { inputClass } from '@/shared/ui/field';
import { statusLabel } from './status-badge';
import { transferTypeOptions } from './transfer-types';

export type Filters = Pick<ListTransactionsQuery, 'status' | 'transferTypeId' | 'from' | 'to'>;

const toIso = (local: string): string | undefined =>
  local ? new Date(local).toISOString() : undefined;
const toLocal = (iso: string | undefined): string =>
  iso ? new Date(iso).toISOString().slice(0, 16) : '';

export function TransactionsFilters({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
}) {
  return (
    <form
      aria-label="Filtros"
      className="grid grid-cols-1 gap-3 rounded border border-zinc-200 bg-white p-4 md:grid-cols-4"
      onSubmit={(event) => event.preventDefault()}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Status</span>
        <select
          className={inputClass}
          value={value.status ?? ''}
          onChange={(event) =>
            onChange({ ...value, status: (event.target.value || undefined) as Filters['status'] })
          }
        >
          <option value="">Todos</option>
          {Object.values(TRANSACTION_STATUS).map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Tipo</span>
        <select
          className={inputClass}
          value={value.transferTypeId ?? ''}
          onChange={(event) =>
            onChange({
              ...value,
              transferTypeId: event.target.value ? Number(event.target.value) : undefined,
            })
          }
        >
          <option value="">Todos</option>
          {transferTypeOptions.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">De</span>
        <input
          type="datetime-local"
          className={inputClass}
          value={toLocal(value.from)}
          onChange={(event) => onChange({ ...value, from: toIso(event.target.value) })}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Até</span>
        <input
          type="datetime-local"
          className={inputClass}
          value={toLocal(value.to)}
          onChange={(event) => onChange({ ...value, to: toIso(event.target.value) })}
        />
      </label>
    </form>
  );
}
