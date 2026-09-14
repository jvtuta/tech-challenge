import type { ArgumentsHost } from '@nestjs/common';
import { DomainError } from '../../domain/domain-error';
import { DomainErrorFilter } from './domain-error.filter';

class SampleError extends DomainError {
  constructor(
    readonly code: string,
    readonly kind: 'invalid' | 'not-found' | 'unavailable',
  ) {
    super('sample');
  }
}

function respond(error: DomainError): { status: number; body: unknown } {
  const result = { status: 0, body: undefined as unknown };
  const response = {
    status: (status: number) => {
      result.status = status;
      return response;
    },
    json: (body: unknown) => {
      result.body = body;
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  new DomainErrorFilter().catch(error, host);
  return result;
}

describe('DomainErrorFilter', () => {
  it.each([
    ['invalid', 422],
    ['not-found', 404],
    ['unavailable', 503],
  ] as const)('maps kind %p to status %p', (kind, status) => {
    expect(respond(new SampleError('SAMPLE', kind))).toEqual({
      status,
      body: { statusCode: status, code: 'SAMPLE', message: 'sample' },
    });
  });
});
