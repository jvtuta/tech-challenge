// Os testes de ponta a ponta usam a infra local do enunciado quando nada for informado.
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/challenge?schema=public';
process.env.KAFKA_BROKERS ??= 'localhost:9092';
