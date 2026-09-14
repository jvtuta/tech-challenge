import { randomUUID } from 'node:crypto';
import type { TransactionStatus } from './transaction';

export const TOPICS = {
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_STATUS_UPDATED: 'transaction.status.updated',
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];

/**
 * Envelope comum a todos os eventos. `eventId` permite ao consumidor detectar duplicatas
 * (entrega at-least-once) e `version` permite evoluir o payload sem quebrar consumidores
 * antigos. A chave da mensagem no Kafka é sempre `transactionExternalId`, para que todos os
 * eventos de uma mesma transação caiam na mesma partição e sejam processados em ordem.
 */
export interface EventEnvelope<TType extends TopicName, TData> {
  eventId: string;
  eventType: TType;
  version: 1;
  occurredAt: string;
  data: TData;
}

export interface TransactionCreatedData {
  transactionExternalId: string;
  value: number;
}

export interface TransactionStatusUpdatedData {
  transactionExternalId: string;
  status: Exclude<TransactionStatus, 'pending'>;
}

export type TransactionCreatedEvent = EventEnvelope<
  typeof TOPICS.TRANSACTION_CREATED,
  TransactionCreatedData
>;

export type TransactionStatusUpdatedEvent = EventEnvelope<
  typeof TOPICS.TRANSACTION_STATUS_UPDATED,
  TransactionStatusUpdatedData
>;

export type TransactionEvent = TransactionCreatedEvent | TransactionStatusUpdatedEvent;

export interface EnvelopeOptions {
  eventId?: string;
  occurredAt?: Date;
}

export function createEnvelope<TType extends TopicName, TData>(
  eventType: TType,
  data: TData,
  options: EnvelopeOptions = {},
): EventEnvelope<TType, TData> {
  return {
    eventId: options.eventId ?? randomUUID(),
    eventType,
    version: 1,
    occurredAt: (options.occurredAt ?? new Date()).toISOString(),
    data,
  };
}
