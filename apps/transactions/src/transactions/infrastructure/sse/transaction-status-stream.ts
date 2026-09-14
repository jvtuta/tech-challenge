import { Injectable } from '@nestjs/common';
import type { TransactionStatus } from '@tech-challenge/contracts';
import { filter, type Observable, Subject } from 'rxjs';

export interface StatusChange {
  transactionExternalId: string;
  status: TransactionStatus;
}

/**
 * Fan-out em memória das mudanças de status para quem estiver assistindo pela interface.
 * Vale para uma instância do serviço; com mais de uma, o fan-out passaria por um pub/sub
 * compartilhado (Redis), o que está registrado no DECISIONS.md como limite conhecido.
 */
@Injectable()
export class TransactionStatusStream {
  private readonly changes = new Subject<StatusChange>();

  publish(change: StatusChange): void {
    this.changes.next(change);
  }

  observe(transactionExternalId: string): Observable<StatusChange> {
    return this.changes.pipe(
      filter((change) => change.transactionExternalId === transactionExternalId),
    );
  }
}
