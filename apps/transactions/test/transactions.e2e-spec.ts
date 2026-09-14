import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EVENT_PUBLISHER, InMemoryEventPublisher } from '@tech-challenge/messaging';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { PendingSweeper } from '../src/transactions/infrastructure/pending-sweeper';

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

    it('keeps the transaction when the broker refuses the event and lets the sweeper republish it', async () => {
      publisher.failWith(new Error('broker unavailable'));

      const { body } = await request(app.getHttpServer())
        .post('/transactions')
        .send(validBody)
        .expect(201);

      expect(body.transactionStatus.name).toBe('pending');
      expect(await prisma.transaction.count()).toBe(1);
      expect(publisher.published).toHaveLength(0);

      // Envelhece a linha para passar do corte do varredor e simula o broker de volta.
      await prisma.transaction.update({
        where: { transactionExternalId: body.transactionExternalId },
        data: { createdAt: new Date(Date.now() - 60_000) },
      });
      publisher.recover();
      const sweeper = app.get(PendingSweeper);

      await expect(sweeper.sweep()).resolves.toBe(1);
      expect(publisher.published.map((event) => event.key)).toEqual([body.transactionExternalId]);
      await expect(sweeper.sweep()).resolves.toBe(1);
      expect(publisher.published).toHaveLength(2);
    });
  });

  describe('GET /transactions', () => {
    async function create(transferTypeId: number, value: number): Promise<string> {
      const { body } = await request(app.getHttpServer())
        .post('/transactions')
        .send({ ...validBody, transferTypeId, value })
        .expect(201);
      return body.transactionExternalId;
    }

    it('lists the most recent first, paginated, with the total of the filter', async () => {
      const first = await create(1, 10);
      const second = await create(1, 20);
      const third = await create(2, 30);

      const { body } = await request(app.getHttpServer())
        .get('/transactions?pageSize=2')
        .expect(200);

      expect(body).toMatchObject({ page: 1, pageSize: 2, total: 3 });
      expect(
        body.items.map((item: { transactionExternalId: string }) => item.transactionExternalId),
      ).toEqual([third, second]);

      const { body: lastPage } = await request(app.getHttpServer())
        .get('/transactions?pageSize=2&page=2')
        .expect(200);
      expect(
        lastPage.items.map((item: { transactionExternalId: string }) => item.transactionExternalId),
      ).toEqual([first]);
    });

    it('filters by status, type and period', async () => {
      await create(1, 10);
      const payment = await create(2, 30);

      const { body: byType } = await request(app.getHttpServer())
        .get('/transactions?transferTypeId=2')
        .expect(200);
      expect(byType.total).toBe(1);
      expect(byType.items[0].transactionExternalId).toBe(payment);

      const { body: pending } = await request(app.getHttpServer())
        .get('/transactions?status=pending')
        .expect(200);
      expect(pending.total).toBe(2);

      const { body: approved } = await request(app.getHttpServer())
        .get('/transactions?status=approved')
        .expect(200);
      expect(approved).toMatchObject({ total: 0, items: [] });

      const yesterday = new Date(Date.now() - 86_400_000).toISOString();
      const { body: before } = await request(app.getHttpServer())
        .get(`/transactions?to=${yesterday}`)
        .expect(200);
      expect(before.total).toBe(0);

      const { body: since } = await request(app.getHttpServer())
        .get(`/transactions?from=${yesterday}`)
        .expect(200);
      expect(since.total).toBe(2);
    });

    it('sorts by value when asked, most recent first otherwise', async () => {
      const cheap = await create(1, 10);
      const expensive = await create(1, 30);
      const middle = await create(2, 20);

      const { body } = await request(app.getHttpServer())
        .get('/transactions?sort=value&sortDir=asc')
        .expect(200);
      expect(
        body.items.map((item: { transactionExternalId: string }) => item.transactionExternalId),
      ).toEqual([cheap, middle, expensive]);
    });

    it('rejects filters outside the contract with 400', async () => {
      await request(app.getHttpServer()).get('/transactions?status=unknown').expect(400);
      await request(app.getHttpServer()).get('/transactions?sort=status').expect(400);
      await request(app.getHttpServer()).get('/transactions?pageSize=500').expect(400);
      await request(app.getHttpServer()).get('/transactions?from=yesterday').expect(400);
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
