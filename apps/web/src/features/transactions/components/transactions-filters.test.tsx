import { fireEvent, render, screen } from '@testing-library/react';
import { TransactionsFilters, type Filters } from './transactions-filters';

/**
 * A conversão do período depende do fuso do navegador, e dentro do Jest atribuir
 * `process.env.TZ` não muda o fuso do V8: quem decide é o ambiente do comando. Por isso o
 * script de teste do dashboard roda esta suíte em três fusos, e a tabela diz o que cada um
 * deve produzir para o mesmo horário digitado. Em setembro de 2026 nenhum deles tem horário
 * de verão. Fuso fora da tabela falha de propósito, para o resultado nunca depender por
 * acidente do fuso da máquina.
 */
const TYPED_LOCAL_TIME = '2026-09-14T10:00';
const instantByTimeZone: Record<string, string> = {
  'America/Sao_Paulo': '2026-09-14T13:00:00.000Z',
  UTC: '2026-09-14T10:00:00.000Z',
  'Asia/Tokyo': '2026-09-14T01:00:00.000Z',
};
const timeZone = process.env.TZ ?? '(nenhum)';
const expectedInstant = instantByTimeZone[timeZone];

function renderFilters(value: Filters = {}) {
  const onChange = jest.fn();
  render(<TransactionsFilters value={value} onChange={onChange} />);
  return { onChange };
}

describe(`TransactionsFilters period in ${timeZone}`, () => {
  it('runs in a time zone the suite knows', () => {
    expect(instantByTimeZone).toHaveProperty(timeZone);
  });

  it('sends the time typed in the browser time zone as an ISO instant', () => {
    const { onChange } = renderFilters();

    fireEvent.change(screen.getByLabelText('De'), { target: { value: TYPED_LOCAL_TIME } });

    expect(onChange).toHaveBeenLastCalledWith({ from: expectedInstant });
  });

  it('keeps showing the typed local time when the instant comes back', () => {
    renderFilters({ from: expectedInstant });

    expect(screen.getByLabelText('De')).toHaveValue(TYPED_LOCAL_TIME);
  });

  it('round trips the end of the period the same way', () => {
    const { onChange } = renderFilters();

    fireEvent.change(screen.getByLabelText('Até'), { target: { value: TYPED_LOCAL_TIME } });
    expect(onChange).toHaveBeenLastCalledWith({ to: expectedInstant });
  });

  it('shows the end of the period in local time too', () => {
    renderFilters({ to: expectedInstant });

    expect(screen.getByLabelText('Até')).toHaveValue(TYPED_LOCAL_TIME);
  });
});

describe('TransactionsFilters', () => {
  it('drops the filter when the field is cleared', () => {
    const { onChange } = renderFilters({ from: '2026-09-14T13:00:00.000Z' });

    fireEvent.change(screen.getByLabelText('De'), { target: { value: '' } });

    expect(onChange).toHaveBeenLastCalledWith({ from: undefined });
  });

  it('renders an unparseable value as an empty field instead of throwing', () => {
    expect(() => renderFilters({ from: 'not-a-date' })).not.toThrow();

    expect(screen.getByLabelText('De')).toHaveValue('');
  });

  it('warns when the period is inverted', () => {
    renderFilters({ from: '2026-09-14T13:00:00.000Z', to: '2026-09-10T13:00:00.000Z' });

    expect(screen.getByRole('alert')).toHaveTextContent('O início do período é depois do fim');
  });

  it('does not warn for a period in order', () => {
    renderFilters({ from: '2026-09-10T13:00:00.000Z', to: '2026-09-14T13:00:00.000Z' });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
