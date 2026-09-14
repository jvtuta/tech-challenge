'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/shared/ui/states';

/**
 * Boundary de erro da rota: qualquer exceção lançada na renderização cai aqui em vez de
 * derrubar a página inteira. `reset` tenta renderizar a rota de novo.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState message={error.message || 'Erro inesperado ao montar a tela'} onRetry={reset} />
  );
}
