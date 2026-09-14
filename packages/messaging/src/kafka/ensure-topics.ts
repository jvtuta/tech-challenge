import { Kafka } from 'kafkajs';

export interface KafkaConnection {
  brokers: string[];
  clientId: string;
}

/**
 * Um consumer pode subir antes de qualquer produtor ter criado o tópico, e o `subscribe` do
 * KafkaJS (que o transporte do NestJS usa) não espera a criação automática. `createTopics`
 * é idempotente: devolve `false` quando o tópico já existe e não altera nada.
 */
export async function ensureTopics(connection: KafkaConnection, topics: string[]): Promise<void> {
  const admin = new Kafka(connection).admin();
  await admin.connect();
  try {
    await admin.createTopics({ topics: topics.map((topic) => ({ topic })), waitForLeaders: true });
  } finally {
    await admin.disconnect();
  }
}
