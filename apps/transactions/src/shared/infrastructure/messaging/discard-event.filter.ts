import { type ArgumentsHost, Catch, Logger, type RpcExceptionFilter } from '@nestjs/common';
import type { KafkaContext } from '@nestjs/microservices';
import { RedeliveryBudget } from '@tech-challenge/messaging';
import { type Observable, of } from 'rxjs';
import { DomainError } from '../../domain/domain-error';
import { MalformedEventError } from './envelope.pipe';

/**
 * Três entregas cobrem a oscilação curta (reconexão do banco, rebalanceamento do grupo). O que
 * não passa em três não é oscilação, é dependência fora do ar, e insistir só trava a partição.
 */
export const MAX_DELIVERIES = 3;

/**
 * Política única de falha dos handlers Kafka. Completar o handler faz o offset avançar;
 * relançar faz o transporte reentregar a mensagem. Descarta o que nunca vai dar certo
 * (mensagem fora do contrato, erro de negócio determinístico), reentrega o resto e desiste
 * depois do teto: a transação continua pendente e o varredor traz o evento de volta.
 */
@Catch()
export class DiscardEventFilter implements RpcExceptionFilter<Error> {
  private readonly logger = new Logger(DiscardEventFilter.name);
  private readonly budget = new RedeliveryBudget(MAX_DELIVERIES);

  catch(error: Error, host: ArgumentsHost): Observable<void> {
    const context = host.switchToRpc().getContext<KafkaContext>();
    const message = context.getMessage();
    const origin = `key=${message.key?.toString()}, offset=${message.offset}`;
    if (this.isDeterministic(error)) {
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

  private isDeterministic(error: Error): boolean {
    return (
      error instanceof MalformedEventError ||
      (error instanceof DomainError && (error.kind === 'invalid' || error.kind === 'not-found'))
    );
  }
}
