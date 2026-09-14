// Os testes de ponta a ponta falam com Postgres e Kafka reais; o padrão de 5 s não basta.
jest.setTimeout(60_000);
