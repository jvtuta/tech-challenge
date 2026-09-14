import { type ArgumentsHost, Catch, Logger, type RpcExceptionFilter } from '@nestjs/common';
import type { KafkaContext } from '@nestjs/microservices';
import { type Observable, of } from 'rxjs';
import { DomainError } from '../../domain/domain-error';
import { MalformedEventError } from './envelope.pipe';

/**
 * Política única de falha dos handlers Kafka. Completar o handler faz o offset avançar;
 * relançar faz o transporte reentregar a mensagem. Descarta o que nunca vai dar certo
 * (mensagem fora do contrato, erro de negócio determinístico) e reentrega o resto.
 */
@Catch()
export class DiscardEventFilter implements RpcExceptionFilter<Error> {
  private readonly logger = new Logger(DiscardEventFilter.name);

  catch(error: Error, host: ArgumentsHost): Observable<void> {
    if (!this.isDeterministic(error)) {
      throw error;
    }
    const message = host.switchToRpc().getContext<KafkaContext>().getMessage();
    this.logger.warn(
      `Discarding message (key=${message.key?.toString()}, offset=${message.offset}): ${error.message}`,
    );
    // O transporte faz `lastValueFrom` no retorno: precisa de um valor, ou vira EmptyError e retry.
    return of(undefined);
  }

  private isDeterministic(error: Error): boolean {
    return (
      error instanceof MalformedEventError ||
      (error instanceof DomainError && (error.kind === 'invalid' || error.kind === 'not-found'))
    );
  }
}
