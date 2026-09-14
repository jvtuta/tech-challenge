import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from './env-config.interface';

/**
 * Único ponto que lê o ambiente. Sem valor padrão de porta: a variável que falta derruba o
 * boot nomeando o que falta.
 */
@Injectable()
export class EnvConfigService implements EnvConfig {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  getPort(): number {
    const raw = this.configService.get<string>('ANTI_FRAUD_PORT')?.trim();
    if (!raw) {
      throw new Error('ANTI_FRAUD_PORT env is required');
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error('ANTI_FRAUD_PORT env must be a positive integer');
    }
    return value;
  }
}
