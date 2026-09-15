import type { TransactionStatus } from '@tech-challenge/contracts';
import { TRANSACTION_STATUS } from '@tech-challenge/contracts';
import type { FinalStatus } from './transaction';

/**
 * Resultado de aplicar um veredito. `not-found` não sai daqui: ele depende de a linha existir,
 * que é pergunta do repositório.
 */
export type SettleOutcome = 'settled' | 'duplicate' | 'conflict';

/**
 * A regra da transição: só `pending` aceita veredito, o mesmo veredito repetido é inócuo e um
 * veredito diferente sobre uma transação já decidida é conflito, porque o primeiro veredito é
 * o que valeu.
 *
 * Quem garante que só uma das transições concorrentes acontece é o `where` da escrita
 * condicional, no repositório; esta função classifica o que sobrou quando a escrita não casou,
 * para o chamador saber se foi duplicata ou conflito. A regra vive aqui, e não em cada
 * adapter, para os dois não divergirem.
 */
export function settleOutcome(current: TransactionStatus, attempted: FinalStatus): SettleOutcome {
  if (current === TRANSACTION_STATUS.PENDING) {
    return 'settled';
  }
  return current === attempted ? 'duplicate' : 'conflict';
}
