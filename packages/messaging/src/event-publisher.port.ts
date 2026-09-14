import type { EventEnvelope, TopicName } from '@tech-challenge/contracts';

/**
 * Mensagem pronta para o broker. A chave define a partição: todos os eventos de uma mesma
 * transação usam o mesmo `key` e por isso são entregues em ordem ao consumidor.
 */
export interface OutboundEvent<TTopic extends TopicName = TopicName> {
  topic: TTopic;
  key: string;
  envelope: EventEnvelope<TTopic>;
}

export interface EventPublisher {
  publish(event: OutboundEvent): Promise<void>;
}

/** Token de injeção da porta; o adapter concreto (Kafka, memória) é decidido pelo módulo. */
export const EVENT_PUBLISHER = Symbol('EventPublisher');
