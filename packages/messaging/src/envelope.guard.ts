import { transactionEventSchema, type TransactionEvent } from '@tech-challenge/contracts';

function decode(raw: string | Buffer): unknown {
  try {
    return JSON.parse(raw.toString());
  } catch {
    return null;
  }
}

/**
 * Valida uma mensagem vinda do broker, seja o bruto (string ou buffer) ou o objeto que o
 * transporte do NestJS já converteu. Devolve `null` para tudo que não seja um envelope do
 * contrato; quem consome decide o que fazer com o `null`.
 */
export function parseEnvelope(raw: unknown): TransactionEvent | null {
  const value = typeof raw === 'string' || Buffer.isBuffer(raw) ? decode(raw) : raw;
  const result = transactionEventSchema.safeParse(value);
  return result.success ? result.data : null;
}
