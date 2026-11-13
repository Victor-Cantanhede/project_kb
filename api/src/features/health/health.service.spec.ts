import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { HealthService } from './health.service.js';
import type { MysqlDatabaseService } from '../../core/database/mysql-database.service.js';

describe('HealthService', () => {
  const originalEnv = process.env.INSTANCE_ID;
  let mockDb: {
    getPool: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
  };
  let fakePool: object;

  beforeEach(() => {
    fakePool = {};
    mockDb = {
      getPool: vi.fn().mockReturnValue(fakePool),
      execute: vi.fn().mockResolvedValue({}),
    };
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.INSTANCE_ID = originalEnv;
    } else {
      delete process.env.INSTANCE_ID;
    }
  });

  it('deve executar SELECT 1 no banco e retornar status ok com fallback api-local', async () => {
    delete process.env.INSTANCE_ID;
    const service = new HealthService(mockDb as unknown as MysqlDatabaseService);

    const result = await service.check();

    expect(mockDb.getPool).toHaveBeenCalledOnce();
    expect(mockDb.execute).toHaveBeenCalledWith(fakePool, 'SELECT 1');
    expect(result).toEqual({
      status: 'ok',
      instance: 'api-local',
    });
  });

  it('deve retornar o instanceId configurado via variável de ambiente INSTANCE_ID', async () => {
    process.env.INSTANCE_ID = 'api2';
    const service = new HealthService(mockDb as unknown as MysqlDatabaseService);

    const result = await service.check();

    expect(mockDb.execute).toHaveBeenCalledWith(fakePool, 'SELECT 1');
    expect(result).toEqual({
      status: 'ok',
      instance: 'api2',
    });
  });

  it('deve propagar erro caso a query no banco falhe', async () => {
    mockDb.execute.mockRejectedValueOnce(new Error('Connection lost'));
    const service = new HealthService(mockDb as unknown as MysqlDatabaseService);

    await expect(service.check()).rejects.toThrow('Connection lost');
  });
});
