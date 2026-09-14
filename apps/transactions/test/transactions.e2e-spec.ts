import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EVENT_PUBLISHER, InMemoryEventPublisher } from '@tech-challenge/messaging';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';

const validBody = {
  accountExternalIdDebit: '3b3a5b2e-6f1c-4c1e-9d1a-1e2f3a4b5c6d',
  accountExternalIdCredit: '9d8c7b6a-5f4e-4d3c-8b2a-1a0f9e8d7c6b',
  transferTypeId: 1,
  value: 120,
};

describe('transactions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let publisher: InMemoryEventPublisher;

  beforeAll(async () => {
    publisher = new InMemoryEventPublisher();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EVENT_PUBLISHER)
      .useValue(publisher)
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    prisma = app.get(PrismaService);
    await app.init();
  });

  beforeEach(async () => {
    await prisma.transaction.deleteMany();
    publisher.published.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /transactions', () => {
    it('creates the transaction as pending and publishes transaction.created keyed by its id', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/transactions')
        .send(validBody)
        .expect(201);

      expect(body).toEqual({
        transactionExternalId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        transactionType: { name: 'transfer' },
        transactionStatus: { name: 'pending' },
        value: 120,
        createdAt: expect.any(String),
      });
      expect(publisher.published).toEqual([
        expect.objectContaining({
          topic: 'transaction.created',
          key: body.transactionExternalId,
          envelope: expect.objectContaining({
            data: { transactionExternalId: body.transactionExternalId, value: 120 },
          }),
        }),
      ]);
    });

    it('rejects a malformed body with 400 without touching the broker', async () => {
      await request(app.getHttpServer())
        .post('/transactions')
        .send({ ...validBody, accountExternalIdDebit: 'not-a-uuid', extra: true })
        .expect(400);

      expect(publisher.published).toHaveLength(0);
      expect(await prisma.transaction.count()).toBe(0);
    });

    it('rejects an unknown transfer type with 422', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/transactions')
        .send({ ...validBody, transferTypeId: 999 })
        .expect(422);

      expect(body.code).toBe('UNKNOWN_TRANSFER_TYPE');
      expect(publisher.published).toHaveLength(0);
    });

    it('does not keep the transaction when the broker refuses the event', async () => {
      publisher.failWith(new Error('broker unavailable'));

      const { body } = await request(app.getHttpServer())
        .post('/transactions')
        .send(validBody)
        .expect(503);

      expect(body.code).toBe('EVENT_PUBLISH_FAILED');
      expect(await prisma.transaction.count()).toBe(0);
      publisher.recover();
    });
  });

  describe('GET /transactions/:transactionExternalId', () => {
    it('returns a created transaction in the response contract', async () => {
      const created = await request(app.getHttpServer()).post('/transactions').send(validBody);

      const { body } = await request(app.getHttpServer())
        .get(`/transactions/${created.body.transactionExternalId}`)
        .expect(200);

      expect(body).toEqual(created.body);
    });

    it('answers 404 for an unknown id and 400 for a malformed one', async () => {
      await request(app.getHttpServer())
        .get('/transactions/3b3a5b2e-6f1c-4c1e-9d1a-1e2f3a4b5c6d')
        .expect(404)
        .expect((res) => expect(res.body.code).toBe('TRANSACTION_NOT_FOUND'));
      await request(app.getHttpServer()).get('/transactions/abc').expect(400);
    });
  });
});
