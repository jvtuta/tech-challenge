import { TRANSFER_TYPE, type TransferTypeId } from '@tech-challenge/contracts';

/** Rótulos do catálogo semeado pela migration; os ids são os do contrato. */
export const transferTypeOptions: { id: TransferTypeId; label: string }[] = [
  { id: TRANSFER_TYPE.TRANSFER, label: 'Transferência' },
  { id: TRANSFER_TYPE.PAYMENT, label: 'Pagamento' },
  { id: TRANSFER_TYPE.WITHDRAWAL, label: 'Saque' },
];
