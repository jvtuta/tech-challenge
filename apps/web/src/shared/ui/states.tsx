import type { ReactNode } from 'react';
import { Button } from './button';

/** Os três estados que toda tela com dados remotos precisa tratar de forma explícita. */
export function LoadingState({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded border border-zinc-200 p-6 text-zinc-500"
    >
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded border border-red-300 bg-red-50 p-6 text-red-800">
      <p className="font-medium">Algo deu errado</p>
      <p className="mt-1 text-sm">{message}</p>
      {onRetry ? (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Tentar de novo
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded border border-dashed border-zinc-300 p-10 text-center text-zinc-600">
      <p className="font-medium text-zinc-800">{title}</p>
      {children ? <div className="mt-2 text-sm">{children}</div> : null}
    </div>
  );
}
