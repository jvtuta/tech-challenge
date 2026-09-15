import { screen } from '@testing-library/react';
import { mockFetchOnce, renderWithQuery, transaction } from '@/test-utils';
import { TransactionDetail } from './transaction-detail';

type Listener = (event: { data: string }) => void;

/** EventSource simulado: guarda os ouvintes para o teste disparar o evento de status. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly listeners = new Map<string, Listener>();
  closed = false;

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, listener);
  }

  close(): void {
    this.closed = true;
  }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  (global as unknown as { EventSource: typeof FakeEventSource }).EventSource = FakeEventSource;
});

describe('TransactionDetail', () => {
  it('subscribes to the status stream while pending and reflects the verdict', async () => {
    mockFetchOnce(200, transaction);

    renderWithQuery(
      <TransactionDetail transactionExternalId={transaction.transactionExternalId} />,
    );

    expect(await screen.findByText('Pendente')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('aguardando o antifraude');
    expect(FakeEventSource.instances[0]?.url).toBe(
      `http://api.test/transactions/${transaction.transactionExternalId}/events`,
    );

    mockFetchOnce(200, { items: [], page: 1, pageSize: 20, total: 0 });
    FakeEventSource.instances[0]?.listeners.get('status')?.({
      data: JSON.stringify({
        transactionExternalId: transaction.transactionExternalId,
        status: 'approved',
      }),
    });

    expect(await screen.findByText('Aprovada')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(FakeEventSource.instances[0]?.closed).toBe(true);
  });

  it('keeps the screen standing when a status message is outside the contract', async () => {
    mockFetchOnce(200, transaction);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    renderWithQuery(
      <TransactionDetail transactionExternalId={transaction.transactionExternalId} />,
    );
    expect(await screen.findByText('Pendente')).toBeInTheDocument();

    expect(() =>
      FakeEventSource.instances[0]?.listeners.get('status')?.({ data: 'not json' }),
    ).not.toThrow();

    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('reconciles with the API when the connection drops', async () => {
    mockFetchOnce(200, transaction);

    renderWithQuery(
      <TransactionDetail transactionExternalId={transaction.transactionExternalId} />,
    );
    expect(await screen.findByText('Pendente')).toBeInTheDocument();
    const callsBeforeDrop = (global.fetch as jest.Mock).mock.calls.length;

    mockFetchOnce(200, { ...transaction, transactionStatus: { name: 'rejected' } });
    FakeEventSource.instances[0]?.listeners.get('error')?.({ data: '' });

    expect(await screen.findByText('Rejeitada')).toBeInTheDocument();
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(callsBeforeDrop);
  });

  it('shows the error state when the transaction does not exist', async () => {
    mockFetchOnce(404, { code: 'TRANSACTION_NOT_FOUND', message: 'Transaction x was not found' });

    renderWithQuery(
      <TransactionDetail transactionExternalId={transaction.transactionExternalId} />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('was not found');
  });
});
