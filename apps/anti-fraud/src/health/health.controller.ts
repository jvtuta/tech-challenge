import { Controller, Get } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';
import {
  HealthCheck,
  type HealthCheckResult,
  HealthCheckService,
  MicroserviceHealthIndicator,
} from '@nestjs/terminus';
import { EnvConfigService } from '../shared/infrastructure/env-config/env-config.service';

/** O antifraude só tem uma dependência que importa: o broker que ele consome. */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly microservice: MicroserviceHealthIndicator,
    private readonly envConfig: EnvConfigService,
  ) {}

  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () =>
        this.microservice.pingCheck('kafka', {
          transport: Transport.KAFKA,
          options: {
            client: {
              brokers: this.envConfig.getKafkaBrokers(),
              clientId: `${this.envConfig.getKafkaClientId()}-health`,
            },
          },
        }),
    ]);
  }
}
