import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { HeroImportJobEntity } from '../domain/entities/hero-import-job.entity.js';
import { ImportsController } from './imports.controller.js';

const JOB_ID = '11111111-1111-4111-8111-111111111111';

function makeJob(): HeroImportJobEntity {
  return new HeroImportJobEntity({
    id: JOB_ID,
    filename: 'herois.csv',
    status: 'processing',
    total_rows: 1,
    processed_rows: 0,
    imported_count: 0,
    duplicate_count: 0,
    error_count: 0,
    errors: [],
    created_at: new Date(),
    updated_at: new Date(),
  });
}

describe('ImportsController', () => {
  it('handles JSON body, text body, list, and get', async () => {
    const job = makeJob();
    const startUseCase = { execute: vi.fn(async () => job) };
    const getUseCase = { execute: vi.fn(async () => job) };
    const listUseCase = { execute: vi.fn(async () => [job]) };

    const controller = new ImportsController(
      startUseCase as never,
      getUseCase as never,
      listUseCase as never,
    );

    const listRes = await controller.listImports();
    expect(listRes.data).toHaveLength(1);

    const getRes = await controller.getImport(JOB_ID);
    expect(getRes.id).toBe(JOB_ID);

    const jsonReq = {
      headers: { 'content-type': 'application/json', 'x-timezone': 'America/Sao_Paulo' },
      body: { filename: 'time.csv', csv: 'name,nickname,date_of_birth,universe,main_power' },
    } as unknown as Request;
    await controller.startImport(jsonReq);
    expect(startUseCase.execute).toHaveBeenCalledWith(
      'time.csv',
      'name,nickname,date_of_birth,universe,main_power',
      'America/Sao_Paulo',
    );

    const textReq = {
      headers: { 'content-type': 'text/csv' },
      body: 'name,nickname,date_of_birth,universe,main_power',
    } as unknown as Request;
    await controller.startImport(textReq);
    expect(startUseCase.execute).toHaveBeenCalledWith(
      'herois.csv',
      'name,nickname,date_of_birth,universe,main_power',
      undefined,
    );
  });
});

