import { Controller, type MessageEvent, Param, ParseUUIDPipe, Sse } from '@nestjs/common';
import { TRANSACTION_STATUS, type TransactionStatus } from '@tech-challenge/contracts';
import { concat, finalize, map, type Observable, of, ReplaySubject, takeWhile } from 'rxjs';
import { TransactionNotFoundError } from '../../application/errors';
import { TransactionQueries } from '../persistence/transaction.queries';
import { type StatusChange, TransactionStatusStream } from './transaction-status-stream';

/**
 * Stream do status de uma transação para a interface. Envia o status atual ao conectar,
 * repassa as mudanças e fecha sozinho quando o status deixa de ser pendente, porque não há
 * mais o que esperar.
 */
@Controller('transactions')
export class TransactionEventsController {
  constructor(
    private readonly queries: TransactionQueries,
    private readonly stream: TransactionStatusStream,
  ) {}

  /**
   * Assina antes de ler. A versão anterior era `concat(atual, stream)`, que só assina o
   * `Subject` depois de a consulta resolver: um veredito aplicado nessa janela se perdia, a
   * tela ficava presa em pendente e, como o estado terminal nunca chegava, a conexão não
   * fechava. O buffer guarda o que acontecer entre a assinatura e a leitura.
   *
   * O handler é `async` de propósito: a existência é checada antes de devolver o Observable,
   * então o `404` ainda é um status HTTP. Lançar de dentro do Observable não mudava mais nada,
   * porque a resposta `text/event-stream` já tinha começado.
   */
  @Sse(':transactionExternalId/events')
  async events(
    @Param('transactionExternalId', ParseUUIDPipe) transactionExternalId: string,
  ): Promise<Observable<MessageEvent>> {
    const buffered = new ReplaySubject<StatusChange>(1);
    const live = this.stream.observe(transactionExternalId).subscribe(buffered);
    try {
      const transaction = await this.queries.findByExternalId(transactionExternalId);
      if (!transaction) {
        throw new TransactionNotFoundError(transactionExternalId);
      }
      const current: StatusChange = {
        transactionExternalId,
        status: transaction.transactionStatus.name,
      };
      return concat(of(current), buffered).pipe(
        // O atual vai na frente e o primeiro terminal completa, então uma leitura antiga não
        // regride um estado final que o cliente já recebeu.
        takeWhile((change) => isPending(change.status), true),
        finalize(() => live.unsubscribe()),
        map((change): MessageEvent => ({ type: 'status', data: change })),
      );
    } catch (error) {
      live.unsubscribe();
      throw error;
    }
  }
}

function isPending(status: TransactionStatus): boolean {
  return status === TRANSACTION_STATUS.PENDING;
}
