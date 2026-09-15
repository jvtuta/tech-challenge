import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EVENT_PUBLISHER, InMemoryEventPublisher } from '@tech-challenge/messaging';
import { TOPICS, createEnvelope, type TransactionStatus } from '@tech-challenge/contracts';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { TransactionAlreadySettledError } from '../src/transactions/domain/transaction-settled.error';
import type { FinalStatus } from '../src/transactions/domain/transaction';
import { TransactionNotFoundError } from '../src/transactions/application/errors';
import { UpdateTransactionStatus } from '../src/transactions/application/update-transaction-status.use-case';
import { TransactionStatusUpdatedController } from '../src/transactions/infrastructure/kafka/transaction-status-updated.controller';
import { TransactionStatusStream } from '../src/transactions/infrastructure/sse/transaction-status-stream';

const validBody = {
  accountExternalIdDebit: '3b3a5b2e-6f1c-4c1e-9d1a-1e2f3a4b5c6d',
  accountExternalIdCredit: '9d8c7b6a-5f4e-4d3c-8b2a-1a0f9e8d7c6b',
  transferTypeId: 1,
  value: 120,
};

/**
 * Concorrência na transição de status, contra o PostgreSQL de verdade: nenhum destes casos é
 * observável com um duplo de persistência, porque o que está sob teste é quem ganha a escrita.
 * Os testes nunca presumem qual concorrente vence, só quantos vencem.
 */
describe('status transition under concurrency (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let updateStatus: UpdateTransactionStatus;
  let controller: TransactionStatusUpdatedController;
  let stream: TransactionStatusStream;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EVENT_PUBLISHER)
      .useValue(new InMemoryEventPublisher())
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    prisma = app.get(PrismaService);
    updateStatus = app.get(UpdateTransactionStatus);
    controller = app.get(TransactionStatusUpdatedController);
    stream = app.get(TransactionStatusStream);
    await app.init();
  });

  beforeEach(async () => {
    await prisma.transaction.deleteMany();
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  async function createPending(): Promise<string> {
    const { body } = await request(app.getHttpServer())
      .post('/transactions')
      .send(validBody)
      .expect(201);
    return body.transactionExternalId;
  }

  const statusOf = async (transactionExternalId: string): Promise<TransactionStatus> => {
    const row = await prisma.transaction.findUniqueOrThrow({
      where: { transactionExternalId },
      select: { status: true },
    });
    return row.status;
  };

  const verdict = (transactionExternalId: string, status: FinalStatus) =>
    createEnvelope(TOPICS.TRANSACTION_STATUS_UPDATED, { transactionExternalId, status });

  it('produces a single transition when the same verdict is applied concurrently', async () => {
    const transactionExternalId = await createPending();
    const update = { transactionExternalId, status: 'approved' as const };

    const results = await Promise.all([updateStatus.execute(update), updateStatus.execute(update)]);

    expect(results.filter((changed) => changed)).toHaveLength(1);
    await expect(statusOf(transactionExternalId)).resolves.toBe('approved');
  });

  it('keeps a single final status when opposite verdicts race', async () => {
    const transactionExternalId = await createPending();

    const results = await Promise.allSettled([
      updateStatus.execute({ transactionExternalId, status: 'approved' }),
      updateStatus.execute({ transactionExternalId, status: 'rejected' }),
    ]);

    const applied = results.filter(
      (result) => result.status === 'fulfilled' && result.value === true,
    );
    const refused = results.filter(
      (result) =>
        result.status === 'rejected' && result.reason instanceof TransactionAlreadySettledError,
    );
    expect(applied).toHaveLength(1);
    expect(refused).toHaveLength(1);
    // Qual dos dois venceu é indiferente; o que importa é que só um resultado sobrou.
    await expect(statusOf(transactionExternalId)).resolves.toMatch(/^(approved|rejected)$/);
  });

  it('does not transition or notify again on a sequential duplicate', async () => {
    const transactionExternalId = await createPending();
    const published = jest.spyOn(stream, 'publish');

    await controller.onStatusUpdated(verdict(transactionExternalId, 'approved'));
    const updatedAfterFirst = (
      await prisma.transaction.findUniqueOrThrow({
        where: { transactionExternalId },
        select: { updatedAt: true },
      })
    ).updatedAt;

    await controller.onStatusUpdated(verdict(transactionExternalId, 'approved'));

    expect(published).toHaveBeenCalledTimes(1);
    await expect(statusOf(transactionExternalId)).resolves.toBe('approved');
    await expect(
      prisma.transaction
        .findUniqueOrThrow({ where: { transactionExternalId }, select: { updatedAt: true } })
        .then((row) => row.updatedAt),
    ).resolves.toEqual(updatedAfterFirst);
  });

  it('refuses a conflicting verdict without overwriting the first one', async () => {
    const transactionExternalId = await createPending();
    await controller.onStatusUpdated(verdict(transactionExternalId, 'approved'));

    await expect(
      updateStatus.execute({ transactionExternalId, status: 'rejected' }),
    ).rejects.toBeInstanceOf(TransactionAlreadySettledError);
    await expect(statusOf(transactionExternalId)).resolves.toBe('approved');
  });

  it('reports an id that never existed', async () => {
    await expect(
      updateStatus.execute({
        transactionExternalId: '00000000-0000-4000-8000-000000000000',
        status: 'approved',
      }),
    ).rejects.toBeInstanceOf(TransactionNotFoundError);
  });

  it('does not notify success when persistence fails', async () => {
    const transactionExternalId = await createPending();
    const published = jest.spyOn(stream, 'publish');
    jest
      .spyOn(updateStatus, 'execute')
      .mockRejectedValueOnce(new Error('connection terminated unexpectedly'));

    await expect(
      controller.onStatusUpdated(verdict(transactionExternalId, 'approved')),
    ).rejects.toThrow('connection terminated unexpectedly');

    expect(published).not.toHaveBeenCalled();
    await expect(statusOf(transactionExternalId)).resolves.toBe('pending');
  });
});
