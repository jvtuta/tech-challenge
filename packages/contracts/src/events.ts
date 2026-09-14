import { randomUUID } from 'node:crypto';
import type { TransactionStatus } from './transaction';

export const TOPICS = {
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_STATUS_UPDATED: 'transaction.status.updated',
} as const;

export interface TransactionCreatedData {
  transactionExternalId: string;
  value: number;
}

export interface TransactionStatusUpdatedData {
  transactionExternalId: string;
  status: Exclude<TransactionStatus, 'pending'>;
}

/** Fonte única do contrato: cada tópico e o payload que ele carrega. */
export interface TopicPayloads {
  [TOPICS.TRANSACTION_CREATED]: TransactionCreatedData;
  [TOPICS.TRANSACTION_STATUS_UPDATED]: TransactionStatusUpdatedData;
}

export type TopicName = keyof TopicPayloads;

export type PayloadOf<TTopic extends TopicName> = TopicPayloads[TTopic];

/**
 * Envelope comum a todos os eventos. `eventId` permite ao consumidor detectar duplicatas
 * (entrega at-least-once) e `version` permite evoluir o payload sem quebrar consumidores
 * antigos. A chave da mensagem no Kafka é sempre `transactionExternalId`, para que todos os
 * eventos de uma mesma transação caiam na mesma partição e sejam processados em ordem.
 */
export interface EventEnvelope<TTopic extends TopicName = TopicName> {
  eventId: string;
  eventType: TTopic;
  version: 1;
  occurredAt: string;
  data: PayloadOf<TTopic>;
}

export type TransactionCreatedEvent = EventEnvelope<typeof TOPICS.TRANSACTION_CREATED>;
export type TransactionStatusUpdatedEvent = EventEnvelope<typeof TOPICS.TRANSACTION_STATUS_UPDATED>;

/** União de todos os eventos, derivada do mapa: um tópico novo entra aqui sozinho. */
export type TransactionEvent = { [TTopic in TopicName]: EventEnvelope<TTopic> }[TopicName];

export interface EnvelopeOptions {
  eventId?: string;
  occurredAt?: Date;
}

export function createEnvelope<TTopic extends TopicName>(
  eventType: TTopic,
  data: PayloadOf<TTopic>,
  options: EnvelopeOptions = {},
): EventEnvelope<TTopic> {
  return {
    eventId: options.eventId ?? randomUUID(),
    eventType,
    version: 1,
    occurredAt: (options.occurredAt ?? new Date()).toISOString(),
    data,
  };
}
