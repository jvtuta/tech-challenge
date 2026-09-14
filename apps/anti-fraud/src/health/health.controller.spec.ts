import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports the service as healthy', () => {
    const controller = new HealthController();

    expect(controller.check()).toEqual({ status: 'ok', service: 'anti-fraud' });
  });
});
