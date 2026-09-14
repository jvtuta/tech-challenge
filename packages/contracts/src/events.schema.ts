import { z } from 'zod';
import { TOPICS, type TransactionEvent } from './events';

const envelope = { eventId: z.string().min(1), version: z.literal(1), occurredAt: z.string() };
const transactionExternalId = z.string().min(1);

/** Forma dos eventos em runtime; `satisfies` prende o schema aos tipos do contrato. */
export const transactionEventSchema = z.discriminatedUnion('eventType', [
  z.object({
    ...envelope,
    eventType: z.literal(TOPICS.TRANSACTION_CREATED),
    data: z.object({ transactionExternalId, value: z.number().finite() }),
  }),
  z.object({
    ...envelope,
    eventType: z.literal(TOPICS.TRANSACTION_STATUS_UPDATED),
    data: z.object({ transactionExternalId, status: z.enum(['approved', 'rejected']) }),
  }),
]) satisfies z.ZodType<TransactionEvent>;
