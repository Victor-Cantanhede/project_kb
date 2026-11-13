import { describe, expect, it, vi } from 'vitest';
import type { HeroFacadeService } from '../../../heroes/index.js';
import { HeroImportJobEntity } from '../../domain/entities/hero-import-job.entity.js';
import type { IImportRepository } from '../../domain/ports/import-repository.port.js';
import { StartCsvImportUseCase } from './start-csv-import.use-case.js';

describe('StartCsvImportUseCase', () => {
  it('creates an import job, processes valid/invalid rows in background, and resolves waitForAll()', async () => {
    const job = new HeroImportJobEntity({
      id: '11111111-1111-4111-8111-111111111111',
      filename: 'herois.csv',
      status: 'processing',
      total_rows: 2,
      processed_rows: 0,
      imported_count: 0,
      duplicate_count: 0,
      error_count: 0,
      errors: [],
      created_at: new Date(),
      updated_at: new Date(),
    });

    const repo: IImportRepository = {
      create: vi.fn(async () => job),
      findById: vi.fn(async () => job),
      listRecent: vi.fn(async () => [job]),
      updateProgress: vi.fn(async () => undefined),
      complete: vi.fn(async () => undefined),
      fail: vi.fn(async () => undefined),
    };

    const heroFacade = {
      insertBatch: vi.fn(async (inputs: readonly unknown[]) => inputs.length),
    } as unknown as HeroFacadeService;

    const useCase = new StartCsvImportUseCase(repo, heroFacade);
    const csv = [
      'name,nickname,date_of_birth,universe,main_power,avatar_url',
      'Peter Parker,Homem-Aranha,2001-08-10,Marvel,Sentido Aranha,',
      'Nome Invalido,Apelido,2099-01-01,Marvel,Poder,',
    ].join('\n');

    const started = await useCase.execute('herois.csv', csv, 'America/Sao_Paulo');
    expect(started.status).toBe('processing');

    await useCase.waitForAll();

    expect(heroFacade.insertBatch).toHaveBeenCalledTimes(1);
    expect(repo.complete).toHaveBeenCalledWith(
      job.id,
      expect.objectContaining({
        processed_rows: 2,
        imported_count: 1,
        duplicate_count: 0,
        error_count: 1,
      }),
    );
  });
});
