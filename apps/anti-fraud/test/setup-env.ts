// Fixture dos testes de ponta a ponta: usa a infra local do enunciado quando nada for informado.
process.env.ANTI_FRAUD_PORT ??= '3002';
process.env.KAFKA_BROKERS ??= 'localhost:9092';
process.env.KAFKA_CLIENT_ID ??= 'anti-fraud-e2e';
process.env.KAFKA_GROUP_ID_ANTI_FRAUD ??= 'anti-fraud-e2e';
