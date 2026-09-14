import Link from 'next/link';
import { EmptyState } from '@/shared/ui/states';

export default function NotFound() {
  return (
    <EmptyState title="Página não encontrada">
      <Link href="/" className="underline">
        Voltar para a listagem
      </Link>
    </EmptyState>
  );
}
