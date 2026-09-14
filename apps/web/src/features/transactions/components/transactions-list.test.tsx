import { screen, within } from '@testing-library/react';
import { mockFetchOnce, renderWithQuery, transaction } from '@/test-utils';
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
});
