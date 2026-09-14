import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from './env-config.interface';

/**
 * Único ponto que lê o ambiente. Sem valor padrão de host, porta ou identificador: a
 * variável que falta derruba o boot nomeando o que falta, em vez de apontar para localhost
 * em silêncio.
 */
@Injectable()
export class EnvConfigService implements EnvConfig {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  getPort(): number {
    return this.requiredNumber('TRANSACTIONS_PORT');
  }

  getDatabaseUrl(): string {
    return this.required('DATABASE_URL');
  }

  getKafkaBrokers(): string[] {
    const brokers = this.required('KAFKA_BROKERS')
      .split(',')
      .map((broker) => broker.trim())
      .filter((broker) => broker.length > 0);
    if (brokers.length === 0) {
      throw new Error('KAFKA_BROKERS env must list at least one broker');
    }
    return brokers;
  }

  getKafkaClientId(): string {
    return this.required('KAFKA_CLIENT_ID');
  }

  private required(key: string): string {
    const value = this.configService.get<string>(key)?.trim();
    if (!value) {
      throw new Error(`${key} env is required`);
    }
    return value;
  }

  private requiredNumber(key: string): number {
    const value = Number(this.required(key));
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${key} env must be a positive integer`);
    }
    return value;
  }
}
