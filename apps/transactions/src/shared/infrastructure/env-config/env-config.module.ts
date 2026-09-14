import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, type ConfigModuleOptions } from '@nestjs/config';
import { join } from 'node:path';

import { EnvConfigService } from './env-config.service';

/**
 * O `.env` do enunciado fica na raiz do monorepo; cada app roda a partir da própria pasta.
 * Variáveis já presentes no processo têm prioridade sobre os arquivos.
 */
@Global()
@Module({})
export class EnvConfigModule {
  static forRoot(options: ConfigModuleOptions = {}): DynamicModule {
    return {
      module: EnvConfigModule,
      global: true,
      imports: [
        ConfigModule.forRoot({
          envFilePath: [join(process.cwd(), '.env'), join(process.cwd(), '..', '..', '.env')],
          ...options,
        }),
      ],
      providers: [EnvConfigService],
      exports: [EnvConfigService],
    };
  }
}
