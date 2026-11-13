import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MysqlImportRepository } from './mysql-import.repository.js';
import type { MysqlDatabaseService } from '../../../../core/database/mysql-database.service.js';

describe('MysqlImportRepository', () => {
  let mockDb: {
    getPool: ReturnType<typeof vi.fn>;
    selectRows: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
  };
  let repo: MysqlImportRepository;

  beforeEach(() => {
    mockDb = {
      getPool: vi.fn().mockReturnValue({}),
      selectRows: vi.fn(),
      execute: vi.fn(),
    };
    repo = new MysqlImportRepository(mockDb as unknown as MysqlDatabaseService);
  });

  describe('create', () => {
    it('inserts a new import job with processing status and returns the entity', async () => {
      mockDb.execute.mockResolvedValueOnce({ affectedRows: 1 });

      const job = await repo.create('heroes.csv', 100);

      expect(job.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(job.filename).toBe('heroes.csv');
      expect(job.status).toBe('processing');
      expect(job.total_rows).toBe(100);
      expect(job.processed_rows).toBe(0);
      expect(job.imported_count).toBe(0);
      expect(job.duplicate_count).toBe(0);
      expect(job.error_count).toBe(0);
      expect(job.errors).toEqual([]);
      expect(job.failure_reason).toBeNull();

      expect(mockDb.execute).toHaveBeenCalledOnce();
      const call = mockDb.execute.mock.calls[0];
      expect(call?.[1]).toContain('INSERT INTO hero_imports');
    });
  });

  describe('findById', () => {
    it('returns the entity when found in database', async () => {
      const now = new Date();
      mockDb.selectRows.mockImplementationOnce((_pool, schema) => [
        schema.parse({
          id: '11111111-1111-4111-8111-111111111111',
          filename: 'heroes.csv',
          status: 'completed',
          total_rows: 50,
          processed_rows: 50,
          imported_count: 48,
          duplicate_count: 1,
          error_count: 1,
          errors: JSON.stringify([{ line: 5, message: 'Data inválida' }]),
          failure_reason: null,
          created_at: now,
          updated_at: now,
        }),
      ]);

      const job = await repo.findById('11111111-1111-4111-8111-111111111111');

      expect(job).not.toBeNull();
      expect(job?.id).toBe('11111111-1111-4111-8111-111111111111');
      expect(job?.status).toBe('completed');
      expect(job?.imported_count).toBe(48);
      expect(job?.errors).toEqual([{ line: 5, message: 'Data inválida' }]);
    });

    it('returns null when not found', async () => {
      mockDb.selectRows.mockResolvedValueOnce([]);

      const job = await repo.findById('22222222-2222-4222-8222-222222222222');
      expect(job).toBeNull();
    });
  });

  describe('listRecent', () => {
    it('returns array of jobs mapped to entities', async () => {
      const now = new Date();
      mockDb.selectRows.mockImplementationOnce((_pool, schema) => [
        schema.parse({
          id: '11111111-1111-4111-8111-111111111111',
          filename: 'heroes.csv',
          status: 'completed',
          total_rows: 10,
          processed_rows: 10,
          imported_count: 10,
          duplicate_count: 0,
          error_count: 0,
          errors: [],
          failure_reason: null,
          created_at: now,
          updated_at: now,
        }),
      ]);

      const list = await repo.listRecent(5);
      expect(list.length).toBe(1);
      expect(list[0]?.id).toBe('11111111-1111-4111-8111-111111111111');
      expect(mockDb.selectRows).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.stringContaining('SELECT'),
        [5],
      );
    });
  });

  describe('updateProgress', () => {
    it('executes UPDATE statement with progress counts and serialized errors', async () => {
      mockDb.execute.mockResolvedValueOnce({ affectedRows: 1 });

      await repo.updateProgress('11111111-1111-4111-8111-111111111111', {
        processed_rows: 50,
        imported_count: 45,
        duplicate_count: 3,
        error_count: 2,
        errors: [
          { line: 3, message: 'Err 1' },
          { line: 7, message: 'Err 2' },
        ],
      });

      expect(mockDb.execute).toHaveBeenCalledOnce();
      const call = mockDb.execute.mock.calls[0];
      expect(call?.[1]).toContain('UPDATE hero_imports');
      expect(call?.[1]).toContain('SET processed_rows = ?');
      expect(call?.[2]?.[0]).toBe(50);
      expect(call?.[2]?.[1]).toBe(45);
      expect(call?.[2]?.[2]).toBe(3);
      expect(call?.[2]?.[3]).toBe(2);
      expect(call?.[2]?.[4]).toBe(
        JSON.stringify([
          { line: 3, message: 'Err 1' },
          { line: 7, message: 'Err 2' },
        ]),
      );
      expect(call?.[2]?.[6]).toBe('11111111-1111-4111-8111-111111111111');
    });
  });

  describe('complete', () => {
    it('updates status to completed with final progress and serialized errors', async () => {
      mockDb.execute.mockResolvedValueOnce({ affectedRows: 1 });

      await repo.complete('11111111-1111-4111-8111-111111111111', {
        processed_rows: 100,
        imported_count: 95,
        duplicate_count: 3,
        error_count: 2,
        errors: [],
      });

      expect(mockDb.execute).toHaveBeenCalledOnce();
      const call = mockDb.execute.mock.calls[0];
      expect(call?.[1]).toContain("status = 'completed'");
    });
  });

  describe('fail', () => {
    it('updates status to failed with failure reason', async () => {
      mockDb.execute.mockResolvedValueOnce({ affectedRows: 1 });

      await repo.fail('11111111-1111-4111-8111-111111111111', 'Database connection lost');

      expect(mockDb.execute).toHaveBeenCalledOnce();
      const call = mockDb.execute.mock.calls[0];
      expect(call?.[1]).toContain("status = 'failed'");
      expect(call?.[2]?.[0]).toBe('Database connection lost');
      expect(call?.[2]?.[2]).toBe('11111111-1111-4111-8111-111111111111');
    });
  });
});
