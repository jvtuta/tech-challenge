import { act, screen, within } from '@testing-library/react';
import { mockFetchOnce, renderWithQuery, transaction } from '@/test-utils';
import { LIST_POLL_INTERVAL_MS } from '../hooks';
import { TransactionsList } from './transactions-list';

describe('TransactionsList', () => {
  it('shows the loading state while the list is being fetched', () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => undefined));

    renderWithQuery(<TransactionsList />);

    expect(screen.getByRole('status')).toHaveTextContent('Carregando transações');
  });

  it('shows the error state with a retry action when the API fails', async () => {
    mockFetchOnce(500, { message: 'database down' });

    renderWithQuery(<TransactionsList />);

    expect(await screen.findByRole('alert')).toHaveTextContent('database down');
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('shows the empty state when there is nothing to list', async () => {
    mockFetchOnce(200, { items: [], page: 1, pageSize: 20, total: 0 });

    renderWithQuery(<TransactionsList />);

    expect(await screen.findByText('Nenhuma transação encontrada')).toBeInTheDocument();
  });

  it('lists the transactions with status, value and a link to the detail', async () => {
    mockFetchOnce(200, { items: [transaction], page: 1, pageSize: 20, total: 1 });

    renderWithQuery(<TransactionsList />);

    const table = await screen.findByRole('table');
    expect(screen.getByRole('link', { name: '3b3a5b2e' })).toHaveAttribute(
      'href',
      '/transactions/3b3a5b2e-6f1c-4c1e-9d1a-1e2f3a4b5c6d',
    );
    expect(within(table).getByText('Pendente')).toBeInTheDocument();
    expect(within(table).getByText(/R\$\s*120,00/)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Paginação' })).toHaveTextContent(
      'Página 1 de 1',
    );
  });

  describe('while there is a pending transaction on the visible page', () => {
    const approved = { ...transaction, transactionStatus: { name: 'approved' as const } };
    const page = (items: unknown[], total: number) => ({ items, page: 1, pageSize: 20, total });

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    async function advanceOnePoll(): Promise<void> {
      await act(async () => {
        jest.advanceTimersByTime(LIST_POLL_INTERVAL_MS);
      });
    }

    it('reaches the final state without navigating, reloading or changing focus', async () => {
      mockFetchOnce(200, page([transaction], 1));
      mockFetchOnce(200, page([approved], 1));

      renderWithQuery(<TransactionsList />);

      const table = await screen.findByRole('table');
      expect(within(table).getByText('Pendente')).toBeInTheDocument();

      await advanceOnePoll();

      expect(await within(table).findByText('Aprovada')).toBeInTheDocument();
      expect(within(table).queryByText('Pendente')).not.toBeInTheDocument();
    });

    it('drops the row and updates the total when it leaves the pending filter', async () => {
      mockFetchOnce(200, page([transaction], 1));
      mockFetchOnce(200, page([], 0));

      renderWithQuery(<TransactionsList />);
      await screen.findByRole('table');

      await advanceOnePoll();

      expect(await screen.findByText('Nenhuma transação encontrada')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('stops polling once nothing on the page is pending', async () => {
      mockFetchOnce(200, page([transaction], 1));
      mockFetchOnce(200, page([approved], 1));

      renderWithQuery(<TransactionsList />);
      await screen.findByRole('table');
      await advanceOnePoll();
      await screen.findByText('Aprovada');
      const callsAfterVerdict = (global.fetch as jest.Mock).mock.calls.length;

      await advanceOnePoll();
      await advanceOnePoll();

      expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsAfterVerdict);
    });

    it('stops polling when the list unmounts', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: '200',
        json: async () => page([transaction], 1),
      });

      const { unmount } = renderWithQuery(<TransactionsList />);
      await screen.findByRole('table');
      await advanceOnePoll();
      unmount();
      const callsAtUnmount = (global.fetch as jest.Mock).mock.calls.length;

      await act(async () => {
        jest.advanceTimersByTime(LIST_POLL_INTERVAL_MS * 3);
      });

      expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsAtUnmount);
    });
  });
});
