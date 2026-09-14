import { get } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createEnvelope, TOPICS } from '@tech-challenge/contracts';
import { ensureTopics, EVENT_PUBLISHER, InMemoryEventPublisher } from '@tech-challenge/messaging';
import { Kafka, type Admin, type Producer } from 'kafkajs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { EnvConfigService } from '../src/shared/infrastructure/env-config/env-config.service';
import { kafkaMicroserviceOptions } from '../src/shared/infrastructure/messaging/kafka.options';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';

/** `startAllMicroservices` resolve antes de o grupo terminar de entrar; produzir antes disso perde a mensagem. */
async function waitForStableGroup(admin: Admin, groupId: string): Promise<void> {
  await admin.connect();
  try {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const { groups } = await admin.describeGroups([groupId]);
      if (groups[0]?.state === 'Stable' && groups[0].members.length > 0) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Consumer group ${groupId} did not become stable within 30s`);
  } finally {
    await admin.disconnect();
  }
}

/** Lê um stream SSE até o evento terminal ou o fechamento; devolve os `data` na ordem. */
function readStatusEvents(url: string): Promise<{ events: unknown[]; closed: boolean }> {
  return new Promise((resolve, reject) => {
    const events: unknown[] = [];
    const timer = setTimeout(() => reject(new Error(`SSE ${url} still open after 30s`)), 30_000);
    get(url, (response) => {
      let buffer = '';
      response.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        for (const line of buffer.split('\n')) {
          if (line.startsWith('data:')) {
            events.push(JSON.parse(line.slice(5).trim()));
          }
        }
        buffer = buffer.slice(buffer.lastIndexOf('\n') + 1);
      });
      response.on('end', () => {
        clearTimeout(timer);
        resolve({ events, closed: true });
      });
    }).on('error', reject);
  });
}

const validBody = {
  accountExternalIdDebit: '3b3a5b2e-6f1c-4c1e-9d1a-1e2f3a4b5c6d',
  accountExternalIdCredit: '9d8c7b6a-5f4e-4d3c-8b2a-1a0f9e8d7c6b',
  transferTypeId: 1,
  value: 120,
};

describe('status update (e2e, Kafka real)', () => {
  let app: INestApplication;
  let producer: Producer;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EVENT_PUBLISHER)
      .useValue(new InMemoryEventPublisher())
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    const envConfig = app.get(EnvConfigService);
    const connection = {
      brokers: envConfig.getKafkaBrokers(),
      clientId: envConfig.getKafkaClientId(),
    };
    await ensureTopics(connection, [TOPICS.TRANSACTION_STATUS_UPDATED]);
    const kafka = new Kafka(connection);
    producer = kafka.producer();
    await producer.connect();
    // O grupo do teste só quer o que for produzido aqui; o backlog do tópico é assunto do serviço.
    const options = kafkaMicroserviceOptions(envConfig);
    app.connectMicroservice({
      ...options,
      options: { ...options.options, subscribe: { fromBeginning: false } },
    });
    await app.startAllMicroservices();
    await app.init();
    await app.listen(0);
    // O transporte do NestJS registra o consumer com o sufixo `-server` no grupo configurado.
    await waitForStableGroup(kafka.admin(), `${envConfig.getKafkaGroupId()}-server`);
    await app.get(PrismaService).transaction.deleteMany();
  });

  afterAll(async () => {
    await app?.close();
    await producer?.disconnect();
  });

  async function publishVerdict(transactionExternalId: string, status: 'approved' | 'rejected') {
    const envelope = createEnvelope(TOPICS.TRANSACTION_STATUS_UPDATED, {
      transactionExternalId,
      status,
    });
    await producer.send({
      topic: TOPICS.TRANSACTION_STATUS_UPDATED,
      messages: [{ key: transactionExternalId, value: JSON.stringify(envelope) }],
    });
  }

  async function waitForStatus(transactionExternalId: string, expected: string): Promise<string> {
    const deadline = Date.now() + 30_000;
    let last = '';
    while (Date.now() < deadline) {
      const { body } = await request(app.getHttpServer()).get(
        `/transactions/${transactionExternalId}`,
      );
      last = body.transactionStatus?.name ?? '';
      if (last === expected) {
        return last;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return last;
  }

  it('applies the verdict that arrives by Kafka and ignores it when delivered again', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/transactions')
      .send(validBody)
      .expect(201);
    const id: string = body.transactionExternalId;

    await publishVerdict(id, 'approved');
    await expect(waitForStatus(id, 'approved')).resolves.toBe('approved');

    await publishVerdict(id, 'approved');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const { body: after } = await request(app.getHttpServer()).get(`/transactions/${id}`);
    expect(after.transactionStatus.name).toBe('approved');
  });

  it('discards a malformed message and a verdict for an unknown transaction without stopping', async () => {
    await producer.send({
      topic: TOPICS.TRANSACTION_STATUS_UPDATED,
      messages: [{ key: 'broken', value: '{not json' }],
    });
    await publishVerdict('9d8c7b6a-5f4e-4d3c-8b2a-1a0f9e8d7c6b', 'approved');
    const { body } = await request(app.getHttpServer())
      .post('/transactions')
      .send(validBody)
      .expect(201);

    await publishVerdict(body.transactionExternalId, 'approved');
    await expect(waitForStatus(body.transactionExternalId, 'approved')).resolves.toBe('approved');
  });

  it('streams the current status, then the verdict, and closes at the terminal state', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/transactions')
      .send(validBody)
      .expect(201);
    const id: string = body.transactionExternalId;
    const url = `${await app.getUrl()}/transactions/${id}/events`;

    const reading = readStatusEvents(url);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await publishVerdict(id, 'approved');

    const { events, closed } = await reading;
    expect(events).toEqual([
      { transactionExternalId: id, status: 'pending' },
      { transactionExternalId: id, status: 'approved' },
    ]);
    expect(closed).toBe(true);
  });

  it('closes immediately with the final status when the transaction is already settled', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/transactions')
      .send(validBody)
      .expect(201);
    const id: string = body.transactionExternalId;
    await publishVerdict(id, 'rejected');
    await expect(waitForStatus(id, 'rejected')).resolves.toBe('rejected');

    const { events, closed } = await readStatusEvents(
      `${await app.getUrl()}/transactions/${id}/events`,
    );

    expect(events).toEqual([{ transactionExternalId: id, status: 'rejected' }]);
    expect(closed).toBe(true);
  });

  it('keeps the first verdict when a conflicting one arrives later', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/transactions')
      .send(validBody)
      .expect(201);
    const id: string = body.transactionExternalId;

    await publishVerdict(id, 'rejected');
    await expect(waitForStatus(id, 'rejected')).resolves.toBe('rejected');

    await publishVerdict(id, 'approved');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const { body: after } = await request(app.getHttpServer()).get(`/transactions/${id}`);
    expect(after.transactionStatus.name).toBe('rejected');
  });
});
