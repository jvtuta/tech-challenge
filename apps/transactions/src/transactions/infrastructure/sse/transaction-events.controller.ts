import { Controller, type MessageEvent, Param, ParseUUIDPipe, Sse } from '@nestjs/common';
import { TRANSACTION_STATUS, type TransactionStatus } from '@tech-challenge/contracts';
import { concat, from, map, type Observable, takeWhile } from 'rxjs';
import { TransactionNotFoundError } from '../../application/errors';
import { TransactionQueries } from '../persistence/transaction.queries';
import { type StatusChange, TransactionStatusStream } from './transaction-status-stream';

/**
 * Stream do status de uma transação para a interface. Envia o status atual ao conectar (o
 * cliente pode ter perdido a mudança entre a consulta e a assinatura), repassa as mudanças e
 * fecha sozinho quando o status deixa de ser pendente, porque não há mais o que esperar.
 */
@Controller('transactions')
export class TransactionEventsController {
  constructor(
    private readonly queries: TransactionQueries,
    private readonly stream: TransactionStatusStream,
  ) {}

  @Sse(':transactionExternalId/events')
  events(
    @Param('transactionExternalId', ParseUUIDPipe) transactionExternalId: string,
  ): Observable<MessageEvent> {
    const current = from(this.queries.findByExternalId(transactionExternalId)).pipe(
      map((transaction): StatusChange => {
        if (!transaction) {
          throw new TransactionNotFoundError(transactionExternalId);
        }
        return { transactionExternalId, status: transaction.transactionStatus.name };
      }),
    );
    return concat(current, this.stream.observe(transactionExternalId)).pipe(
      takeWhile((change) => isPending(change.status), true),
      map((change): MessageEvent => ({ type: 'status', data: change })),
    );
  }
}

function isPending(status: TransactionStatus): boolean {
  return status === TRANSACTION_STATUS.PENDING;
}
