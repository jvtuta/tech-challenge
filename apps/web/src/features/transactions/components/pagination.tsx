import { Button } from '@/shared/ui/button';

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between text-sm text-zinc-600">
      <span>
        Página {page} de {pages} ({total} {total === 1 ? 'transação' : 'transações'})
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Anterior
        </Button>
        <Button variant="secondary" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          Próxima
        </Button>
      </div>
    </nav>
  );
}
