import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EVENT_PUBLISHER, InMemoryEventPublisher } from '@tech-challenge/messaging';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { UpdateTransactionStatus } from '../src/transactions/application/update-transaction-status.use-case';

const validBody = {
  accountExternalIdDebit: '3b3a5b2e-6f1c-4c1e-9d1a-1e2f3a4b5c6d',
  accountExternalIdCredit: '9d8c7b6a-5f4e-4d3c-8b2a-1a0f9e8d7c6b',
  transferTypeId: 1,
  value: 120,
};

/**
 * Comportamento HTTP do stream, medido e não presumido: uma exceção lançada de dentro do
 * Observable já não muda o status, porque a resposta `text/event-stream` teria começado.
 */
describe('GET /transactions/:id/events (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EVENT_PUBLISHER)
      .useValue(new InMemoryEventPublisher())
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    prisma = app.get(PrismaService);
    await app.init();
  });

  beforeEach(async () => {
    await prisma.transaction.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 400 for a malformed id', async () => {
    await request(app.getHttpServer()).get('/transactions/not-a-uuid/events').expect(400);
  });

  it('answers 404 for an id that never existed', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/transactions/00000000-0000-4000-8000-000000000000/events')
      .expect(404);

    expect(body.code).toBe('TRANSACTION_NOT_FOUND');
  });

  it('reports the final state and closes for a transaction already settled', async () => {
    const { body: created } = await request(app.getHttpServer())
      .post('/transactions')
      .send(validBody)
      .expect(201);
    await app
      .get(UpdateTransactionStatus)
      .execute({ transactionExternalId: created.transactionExternalId, status: 'rejected' });

    // Já decidida, o stream fecha no primeiro evento, então a resposta chega inteira.
    const response = await request(app.getHttpServer())
      .get(`/transactions/${created.transactionExternalId}/events`)
      .expect(200);

    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.text).toContain('"status":"rejected"');
  });
});
