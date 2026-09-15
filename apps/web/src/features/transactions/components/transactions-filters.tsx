'use client';

import { TRANSACTION_STATUS, type ListTransactionsQuery } from '@tech-challenge/contracts';
import { inputClass } from '@/shared/ui/field';
import { statusLabel } from './status-badge';
import { transferTypeOptions } from './transfer-types';

export type Filters = Pick<ListTransactionsQuery, 'status' | 'transferTypeId' | 'from' | 'to'>;

/**
 * O campo `datetime-local` fala no fuso do navegador e o filtro viaja como instante ISO com
 * fuso. Na ida, `new Date` sobre uma string sem fuso já interpreta como local. Na volta, é
 * preciso montar a string com os getters locais: `toISOString` devolveria o horário em UTC e
 * o campo passaria a mostrar outro horário a cada re-render.
 */
const pad = (value: number): string => String(value).padStart(2, '0');

const toIso = (local: string): string | undefined => {
  const date = new Date(local);
  return local && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined;
};

const toLocal = (iso: string | undefined): string => {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

/** Período invertido devolveria lista vazia sem explicação; o aviso diz o que corrigir. */
const isInverted = ({ from, to }: Filters): boolean =>
  from !== undefined && to !== undefined && from > to;

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
      {isInverted(value) ? (
        <p role="alert" className="text-sm text-red-700 md:col-span-4">
          O início do período é depois do fim, então nenhuma transação pode casar com ele.
        </p>
      ) : null}
    </form>
  );
}
