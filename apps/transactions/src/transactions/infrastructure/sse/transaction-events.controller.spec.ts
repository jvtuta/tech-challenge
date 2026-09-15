import type { TransactionResponse } from '@tech-challenge/contracts';
import { lastValueFrom, Observable, toArray } from 'rxjs';
import { TransactionNotFoundError } from '../../application/errors';
import type { TransactionQueries } from '../persistence/transaction.queries';
import { TransactionEventsController } from './transaction-events.controller';
import { type StatusChange, TransactionStatusStream } from './transaction-status-stream';

const transactionExternalId = '3b3a5b2e-6f1c-4c1e-9d1a-1e2f3a4b5c6d';

const response = (
  status: TransactionResponse['transactionStatus']['name'],
): TransactionResponse => ({
  transactionExternalId,
  transactionType: { name: 'transfer' },
  transactionStatus: { name: status },
  value: 120,
  createdAt: '2026-09-14T09:00:00.000Z',
});

/**
 * A leitura do status atual é uma promise que o teste resolve na mão, para publicar o veredito
 * exatamente na janela entre a assinatura e a leitura. É a interleaving que a versão anterior
 * perdia.
 */
function setup() {
  let resolveRead!: (transaction: TransactionResponse | null) => void;
  const findByExternalId = jest.fn(
    () =>
      new Promise<TransactionResponse | null>((resolve) => {
        resolveRead = resolve;
      }),
  );
  const stream = new TransactionStatusStream();

  // Conta assinaturas e desmontagens do fan-out, para provar que não sobra ouvinte.
  let subscribed = 0;
  let torndown = 0;
  const observe = stream.observe.bind(stream);
  jest.spyOn(stream, 'observe').mockImplementation(
    (id) =>
      new Observable<StatusChange>((subscriber) => {
        subscribed += 1;
        const inner = observe(id).subscribe(subscriber);
        return () => {
          torndown += 1;
          inner.unsubscribe();
        };
      }),
  );

  const controller = new TransactionEventsController(
    { findByExternalId } as unknown as TransactionQueries,
    stream,
  );
  return {
    controller,
    stream,
    resolveRead: (transaction: TransactionResponse | null) => resolveRead(transaction),
    listeners: () => ({ subscribed, torndown }),
  };
}

describe('TransactionEventsController', () => {
  it('does not lose a verdict applied between the subscription and the read', async () => {
    const { controller, stream, resolveRead, listeners } = setup();

    const opening = controller.events(transactionExternalId);
    // O veredito chega enquanto a leitura do status atual ainda não resolveu.
    stream.publish({ transactionExternalId, status: 'approved' });
    resolveRead(response('pending'));

    const events = await lastValueFrom((await opening).pipe(toArray()));

    expect(events.map((event) => event.data)).toEqual([
      { transactionExternalId, status: 'pending' },
      { transactionExternalId, status: 'approved' },
    ]);
    expect(listeners()).toEqual({ subscribed: 1, torndown: 1 });
  });

  it('reports the final state and closes for a transaction already settled', async () => {
    const { controller, resolveRead, listeners } = setup();

    const opening = controller.events(transactionExternalId);
    resolveRead(response('approved'));

    const events = await lastValueFrom((await opening).pipe(toArray()));

    expect(events.map((event) => event.data)).toEqual([
      { transactionExternalId, status: 'approved' },
    ]);
    expect(listeners()).toEqual({ subscribed: 1, torndown: 1 });
  });

  it('keeps the stream open on pending and closes on the verdict', async () => {
    const { controller, stream, resolveRead } = setup();

    const opening = controller.events(transactionExternalId);
    resolveRead(response('pending'));
    const events = (await opening).pipe(toArray());
    const collected = lastValueFrom(events);
    stream.publish({ transactionExternalId, status: 'rejected' });

    expect((await collected).map((event) => event.data)).toEqual([
      { transactionExternalId, status: 'pending' },
      { transactionExternalId, status: 'rejected' },
    ]);
  });

  it('rejects an unknown id and leaves no listener behind', async () => {
    const { controller, resolveRead, listeners } = setup();

    const opening = controller.events(transactionExternalId);
    resolveRead(null);

    await expect(opening).rejects.toBeInstanceOf(TransactionNotFoundError);
    expect(listeners()).toEqual({ subscribed: 1, torndown: 1 });
  });
});
