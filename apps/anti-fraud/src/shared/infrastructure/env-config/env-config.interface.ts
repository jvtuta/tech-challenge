export interface EnvConfig {
  getPort(): number;
  getKafkaBrokers(): string[];
  getKafkaClientId(): string;
  getKafkaGroupId(): string;
}
