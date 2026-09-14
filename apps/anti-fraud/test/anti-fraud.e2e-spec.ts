import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  createEnvelope,
  TOPICS,
  type TransactionStatusUpdatedEvent,
} from '@tech-challenge/contracts';
import { parseEnvelope } from '@tech-challenge/messaging';
import { Kafka, type Consumer, type Producer } from 'kafkajs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { EnvConfigService } from '../src/shared/infrastructure/env-config/env-config.service';
import { kafkaMicroserviceOptions } from '../src/shared/infrastructure/messaging/kafka.options';

const brokers = (process.env.KAFKA_BROKERS ?? '').split(',');

describe('anti-fraud (e2e, Kafka real)', () => {
  let app: INestApplication;
  let producer: Producer;
  let verdicts: Consumer;
  const received = new Map<string, TransactionStatusUpdatedEvent>();

  beforeAll(async () => {
    const kafka = new Kafka({ brokers, clientId: 'anti-fraud-e2e-probe' });
    const admin = kafka.admin();
    await admin.connect();
    await admin.createTopics({
      topics: [{ topic: TOPICS.TRANSACTION_CREATED }, { topic: TOPICS.TRANSACTION_STATUS_UPDATED }],
      waitForLeaders: true,
    });
    await admin.disconnect();
    producer = kafka.producer();
    verdicts = kafka.consumer({ groupId: `anti-fraud-e2e-probe-${randomUUID()}` });
    await producer.connect();
    await verdicts.connect();
    await verdicts.subscribe({ topic: TOPICS.TRANSACTION_STATUS_UPDATED, fromBeginning: false });
    await verdicts.run({
      eachMessage: async ({ message }) => {
        const envelope = parseEnvelope(message.value);
        if (envelope?.eventType === TOPICS.TRANSACTION_STATUS_UPDATED) {
          received.set(message.key?.toString() ?? '', envelope);
        }
      },
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.connectMicroservice(kafkaMicroserviceOptions(app.get(EnvConfigService)));
    await app.startAllMicroservices();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await verdicts?.disconnect();
    await producer?.disconnect();
  });

  async function publishCreated(value: number): Promise<string> {
    const transactionExternalId = randomUUID();
    const envelope = createEnvelope(TOPICS.TRANSACTION_CREATED, { transactionExternalId, value });
    await producer.send({
      topic: TOPICS.TRANSACTION_CREATED,
      messages: [{ key: transactionExternalId, value: JSON.stringify(envelope) }],
    });
    return transactionExternalId;
  }

  async function waitForVerdict(key: string): Promise<TransactionStatusUpdatedEvent> {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const verdict = received.get(key);
      if (verdict) {
        return verdict;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(`No verdict for ${key} within 30s`);
  }

  it('reports the broker as reachable', async () => {
    const { body } = await request(app.getHttpServer()).get('/health').expect(200);

    expect(body.status).toBe('ok');
    expect(body.info.kafka.status).toBe('up');
  });

  it('rejects a transaction above the limit and approves one within it, keyed by the transaction', async () => {
    const rejectedId = await publishCreated(1500);
    const approvedId = await publishCreated(250);

    const rejected = await waitForVerdict(rejectedId);
    const approved = await waitForVerdict(approvedId);

    expect(rejected.data).toEqual({ transactionExternalId: rejectedId, status: 'rejected' });
    expect(approved.data).toEqual({ transactionExternalId: approvedId, status: 'approved' });
  });

  it('ignores a message outside the contract without stopping', async () => {
    await producer.send({
      topic: TOPICS.TRANSACTION_CREATED,
      messages: [{ key: 'broken', value: '{not json' }],
    });
    const approvedId = await publishCreated(10);

    await expect(waitForVerdict(approvedId)).resolves.toBeDefined();
    expect(received.has('broken')).toBe(false);
  });
});
