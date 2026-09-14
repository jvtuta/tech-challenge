// Fixture dos testes de ponta a ponta: usa a infra local do enunciado quando nada for informado.
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/challenge?schema=public';
process.env.TRANSACTIONS_PORT ??= '3001';
process.env.KAFKA_BROKERS ??= 'localhost:9092';
process.env.KAFKA_CLIENT_ID ??= 'transactions-e2e';
