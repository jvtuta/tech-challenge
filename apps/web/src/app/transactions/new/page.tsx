import Link from 'next/link';
import { TransactionForm } from '@/features/transactions/components/transaction-form';

export default function NewTransactionPage() {
  return (
    <section className="flex flex-col gap-4">
      <Link href="/" className="text-sm underline">
        Voltar para a listagem
      </Link>
      <h1 className="text-2xl font-semibold">Nova transação</h1>
      <TransactionForm />
    </section>
  );
}
