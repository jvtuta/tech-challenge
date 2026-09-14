import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';

/** Renderiza com um QueryClient sem retry, para o estado de erro aparecer na primeira falha. */
export function renderWithQuery(ui: ReactElement): RenderResult {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

export function mockFetchOnce(status: number, body: unknown): void {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  });
}

export const transaction = {
  transactionExternalId: '3b3a5b2e-6f1c-4c1e-9d1a-1e2f3a4b5c6d',
  transactionType: { name: 'transfer' },
  transactionStatus: { name: 'pending' as const },
  value: 120,
  createdAt: '2026-09-14T09:00:00.000Z',
};
