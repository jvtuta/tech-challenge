import { type ArgumentsHost, Catch, Logger, type RpcExceptionFilter } from '@nestjs/common';
import type { KafkaContext } from '@nestjs/microservices';
import { RedeliveryBudget } from '@tech-challenge/messaging';
import { type Observable, of } from 'rxjs';
import { MalformedEventError } from './envelope.pipe';

/**
 * Três entregas cobrem a oscilação curta (broker reeleger o coordenador, rebalanceamento do
 * grupo). O que não passa em três não é oscilação, e insistir só trava a partição.
 */
export const MAX_DELIVERIES = 3;

/**
 * Política única de falha dos handlers Kafka. Completar o handler faz o offset avançar;
 * relançar faz o transporte reentregar a mensagem. O antifraude descarta o que nunca vai dar
 * certo (mensagem fora do contrato), reentrega o resto, como o broker fora na hora de publicar
 * o veredito, e desiste depois do teto: a transação continua pendente no outro serviço e o
 * varredor de lá republica a criação.
 */
@Catch()
export class DiscardEventFilter implements RpcExceptionFilter<Error> {
  private readonly logger = new Logger(DiscardEventFilter.name);
  private readonly budget = new RedeliveryBudget(MAX_DELIVERIES);

  catch(error: Error, host: ArgumentsHost): Observable<void> {
    const context = host.switchToRpc().getContext<KafkaContext>();
    const message = context.getMessage();
    const origin = `key=${message.key?.toString()}, offset=${message.offset}`;
    if (error instanceof MalformedEventError) {
      this.logger.warn(`Discarding message (${origin}): ${error.message}`);
      // O transporte faz `lastValueFrom` no retorno: precisa de um valor, ou vira EmptyError e retry.
      return of(undefined);
    }
    const { deliveries, exhausted } = this.budget.spend(
      context.getTopic(),
      context.getPartition(),
      message.offset,
    );
    if (!exhausted) {
      throw error;
    }
    this.logger.error(
      `Giving up on message (${origin}) after ${deliveries} deliveries: ${error.message}`,
    );
    return of(undefined);
  }
}
