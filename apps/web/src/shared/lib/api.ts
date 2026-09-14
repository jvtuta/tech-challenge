export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** A URL da API vem do ambiente no build; sem ela o dashboard não sabe com quem falar. */
export function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    throw new Error('NEXT_PUBLIC_API_URL is required');
  }
  return `${base}${path}`;
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { code?: string; message?: unknown };
    const message = Array.isArray(body.message)
      ? body.message.join('; ')
      : String(body.message ?? response.statusText);
    throw new ApiError(response.status, body.code, message);
  }
  return (await response.json()) as T;
}
