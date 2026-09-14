export interface EnvConfig {
  getPort(): number;
  getDatabaseUrl(): string;
  getKafkaBrokers(): string[];
  getKafkaClientId(): string;
}
