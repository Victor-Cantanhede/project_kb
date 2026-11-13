import { describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller.js';
import type { HealthService } from './health.service.js';

describe('HealthController', () => {
  it('deve delegar a verificação de saúde para o HealthService', async () => {
    const mockHealthService = {
      check: vi.fn().mockResolvedValue({
        status: 'ok',
        instance: 'api1',
      }),
    };

    const controller = new HealthController(mockHealthService as unknown as HealthService);
    const result = await controller.check();

    expect(mockHealthService.check).toHaveBeenCalledOnce();
    expect(result).toEqual({
      status: 'ok',
      instance: 'api1',
    });
  });
});
