import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError, type DomainErrorKind } from '../../domain/domain-error';

/** Única tradução de categoria de erro para HTTP; o domínio e a aplicação não conhecem status. */
const STATUS_BY_KIND: Record<DomainErrorKind, HttpStatus> = {
  invalid: HttpStatus.UNPROCESSABLE_ENTITY,
  'not-found': HttpStatus.NOT_FOUND,
  unavailable: HttpStatus.SERVICE_UNAVAILABLE,
};

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
  catch(error: DomainError, host: ArgumentsHost): void {
    const status = STATUS_BY_KIND[error.kind];
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, code: error.code, message: error.message });
  }
}
