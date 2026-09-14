import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RouteError from './error';

describe('RouteError', () => {
  it('shows the failure as an alert and lets the user try the route again', async () => {
    const reset = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    render(<RouteError error={new Error('render exploded')} reset={reset} />);

    expect(screen.getByRole('alert')).toHaveTextContent('render exploded');
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
