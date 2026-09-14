import { type ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../../domain/domain-error';

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
  catch(error: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response
      .status(error.httpStatus)
      .json({ statusCode: error.httpStatus, code: error.code, message: error.message });
  }
}
