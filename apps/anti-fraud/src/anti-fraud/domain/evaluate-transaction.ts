import { TRANSACTION_STATUS, type TransactionStatus } from '@tech-challenge/contracts';

/** Regra do enunciado: valor acima de 1000 é rejeitado; até 1000, inclusive, é aprovado. */
export const APPROVAL_LIMIT = 1000;

export type FraudVerdict = Exclude<TransactionStatus, 'pending'>;

export interface TransactionToEvaluate {
  transactionExternalId: string;
  value: number;
}

/**
 * Função pura: recebe o que o evento traz e devolve o veredito. Não conhece Kafka, banco
 * nem o NestJS, por isso é testada só com valores.
 */
export function evaluateTransaction(transaction: TransactionToEvaluate): FraudVerdict {
  return transaction.value > APPROVAL_LIMIT
    ? TRANSACTION_STATUS.REJECTED
    : TRANSACTION_STATUS.APPROVED;
}
