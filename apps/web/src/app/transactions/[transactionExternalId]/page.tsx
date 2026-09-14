import { TransactionDetail } from '@/features/transactions/components/transaction-detail';

export default async function TransactionPage({
  params,
}: {
  params: Promise<{ transactionExternalId: string }>;
}) {
  const { transactionExternalId } = await params;
  return <TransactionDetail transactionExternalId={transactionExternalId} />;
}
