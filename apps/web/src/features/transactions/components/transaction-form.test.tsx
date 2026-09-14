import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFetchOnce, renderWithQuery, transaction } from '@/test-utils';
import { TransactionForm } from './transaction-form';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

describe('TransactionForm', () => {
  it('fills an account with a generated uuid', async () => {
    renderWithQuery(<TransactionForm />);

    await userEvent.click(screen.getByRole('button', { name: 'Gerar conta de débito' }));

    expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: 'Conta de débito' }).value,
    ).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('validates the fields before calling the API', async () => {
    renderWithQuery(<TransactionForm />);

    await userEvent.type(screen.getByRole('textbox', { name: 'Conta de débito' }), 'not-a-uuid');
    await userEvent.click(screen.getByRole('button', { name: 'Criar transação' }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.map((alert) => alert.textContent)).toEqual(
      expect.arrayContaining(['Informe um UUID válido', 'O valor deve ser maior que zero']),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('creates the transaction and navigates to its detail', async () => {
    mockFetchOnce(201, transaction);
    renderWithQuery(<TransactionForm />);

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Conta de débito' }),
      transaction.transactionExternalId,
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Conta de crédito' }),
      '9d8c7b6a-5f4e-4d3c-8b2a-1a0f9e8d7c6b',
    );
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), '2');
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Valor' }), '120');
    await userEvent.click(screen.getByRole('button', { name: 'Criar transação' }));

    await screen.findByRole('button', { name: 'Criar transação' });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://api.test/transactions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          accountExternalIdDebit: transaction.transactionExternalId,
          accountExternalIdCredit: '9d8c7b6a-5f4e-4d3c-8b2a-1a0f9e8d7c6b',
          transferTypeId: 2,
          value: 120,
        }),
      }),
    );
    expect(push).toHaveBeenCalledWith(`/transactions/${transaction.transactionExternalId}`);
  });
});
