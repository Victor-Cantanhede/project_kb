import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MysqlHeroRepository } from './mysql-hero.repository.js';
import type { MysqlDatabaseService } from '../../../../core/database/mysql-database.service.js';
import type { Tx } from '../../../../core/database/mysql-transaction.manager.js';

describe('MysqlHeroRepository', () => {
  let mockDb: {
    getPool: ReturnType<typeof vi.fn>;
    selectRows: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
  };
  let repo: MysqlHeroRepository;

  beforeEach(() => {
    mockDb = {
      getPool: vi.fn().mockReturnValue({}),
      selectRows: vi.fn(),
      execute: vi.fn(),
    };
    repo = new MysqlHeroRepository(mockDb as unknown as MysqlDatabaseService);
  });

  describe('insert', () => {
    const input = {
      name: 'Robert Bruce Banner',
      nickname: 'Hulk',
      date_of_birth: '1962-04-10',
      universe: 'Marvel',
      main_power: 'Força',
      avatar_url: null,
    };

    it('should insert hero successfully and return kind: created with generated UUID', async () => {
      mockDb.execute.mockResolvedValueOnce({ affectedRows: 1 });

      const outcome = await repo.insert(input, { key: 'key-123', hash: 'hash-abc' });

      expect(outcome.kind).toBe('created');
      if (outcome.kind === 'created') {
        expect(outcome.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
      }
      expect(mockDb.execute).toHaveBeenCalledOnce();
      const callArgs = mockDb.execute.mock.calls[0];
      expect(callArgs![1]).toContain('INSERT INTO heroes');
    });

    it('should return duplicate_idempotency_key when key conflicts', async () => {
      const dupError = {
        code: 'ER_DUP_ENTRY',
        sqlMessage: "Duplicate entry 'key-123' for key 'uq_heroes_idempotency_key'",
      };
      mockDb.execute.mockRejectedValueOnce(dupError);

      const outcome = await repo.insert(input, { key: 'key-123', hash: 'hash-abc' });
      expect(outcome.kind).toBe('duplicate_idempotency_key');
    });

    it('should return duplicate_hero when unique identity conflicts', async () => {
      const dupError = {
        code: 'ER_DUP_ENTRY',
        sqlMessage: "Duplicate entry '...' for key 'uq_heroes_identity'",
      };
      mockDb.execute.mockRejectedValueOnce(dupError);

      const outcome = await repo.insert(input);
      expect(outcome.kind).toBe('duplicate_hero');
    });

    it('should rethrow unexpected database errors', async () => {
      mockDb.execute.mockRejectedValueOnce(new Error('Connection lost'));
      await expect(repo.insert(input)).rejects.toThrow('Connection lost');
    });
  });

  describe('insertMany', () => {
    it('should return 0 immediately if inputs array is empty', async () => {
      const count = await repo.insertMany([]);
      expect(count).toBe(0);
      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('should execute INSERT IGNORE and return affected rows', async () => {
      mockDb.execute.mockResolvedValueOnce({ affectedRows: 2 });

      const count = await repo.insertMany([
        {
          name: 'Hero 1',
          nickname: 'H1',
          date_of_birth: '1990-01-01',
          universe: 'Marvel',
          main_power: 'Power 1',
          avatar_url: null,
        },
        {
          name: 'Hero 2',
          nickname: 'H2',
          date_of_birth: '1992-02-02',
          universe: 'DC',
          main_power: 'Power 2',
          avatar_url: null,
        },
      ]);

      expect(count).toBe(2);
      expect(mockDb.execute).toHaveBeenCalledOnce();
      expect(mockDb.execute.mock.calls[0]![1]).toContain('INSERT IGNORE INTO heroes');
    });
  });

  describe('findById & findByIdIncludingDeleted', () => {
    it('should return HeroEntity when found', async () => {
      mockDb.selectRows.mockResolvedValueOnce([
        {
          id: 'uuid-1',
          name: 'Banner',
          nickname: 'Hulk',
          date_of_birth: '1962-04-10',
          universe: 'Marvel',
          main_power: 'Força',
          avatar_url: null,
          is_active: true,
          version: 1,
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-01'),
          deleted_at: null,
        },
      ]);

      const hero = await repo.findById('uuid-1');
      expect(hero).not.toBeNull();
      expect(hero?.id).toBe('uuid-1');
      expect(hero?.nickname).toBe('Hulk');
    });

    it('should return null when not found', async () => {
      mockDb.selectRows.mockResolvedValueOnce([]);
      const hero = await repo.findById('non-existent');
      expect(hero).toBeNull();
    });

    it('findByIdIncludingDeleted queries without deleted_at check', async () => {
      mockDb.selectRows.mockResolvedValueOnce([
        {
          id: 'uuid-del',
          name: 'Deleted',
          nickname: 'Del',
          date_of_birth: '1962-04-10',
          universe: 'Marvel',
          main_power: 'Força',
          avatar_url: null,
          is_active: true,
          version: 1,
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-01'),
          deleted_at: new Date('2026-02-01'),
        },
      ]);

      const hero = await repo.findByIdIncludingDeleted('uuid-del');
      expect(hero).not.toBeNull();
      expect(hero?.deleted_at).toBeInstanceOf(Date);
      expect(mockDb.selectRows.mock.calls[0]![2]).not.toContain('deleted_at IS NULL');
    });
  });

  describe('findByIdempotencyKey', () => {
    it('should return null when key is not found', async () => {
      mockDb.selectRows.mockResolvedValueOnce([]);
      const result = await repo.findByIdempotencyKey('not-found');
      expect(result).toBeNull();
    });

    it('should return hero and requestHash when active hero found', async () => {
      mockDb.selectRows.mockResolvedValueOnce([
        {
          id: 'uuid-1',
          name: 'Banner',
          nickname: 'Hulk',
          date_of_birth: '1962-04-10',
          universe: 'Marvel',
          main_power: 'Força',
          avatar_url: null,
          is_active: true,
          version: 1,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          idempotency_hash: 'hash-123',
        },
      ]);

      const result = await repo.findByIdempotencyKey('key-123');
      expect(result).not.toBeNull();
      expect(result?.hero).not.toBeNull();
      expect(result?.requestHash).toBe('hash-123');
    });

    it('should return hero: null when previously created hero was deleted', async () => {
      mockDb.selectRows.mockResolvedValueOnce([
        {
          id: 'uuid-1',
          name: 'Banner',
          nickname: 'Hulk',
          date_of_birth: '1962-04-10',
          universe: 'Marvel',
          main_power: 'Força',
          avatar_url: null,
          is_active: true,
          version: 1,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: new Date(),
          idempotency_hash: 'hash-123',
        },
      ]);

      const result = await repo.findByIdempotencyKey('key-123');
      expect(result).not.toBeNull();
      expect(result?.hero).toBeNull();
      expect(result?.requestHash).toBe('hash-123');
    });
  });

  describe('list', () => {
    it('should build deferred join SQL with search and cursor tie-breakers', async () => {
      mockDb.selectRows.mockResolvedValueOnce([]);

      await repo.list({
        search: 'Hulk%Special_',
        after: { at: new Date('2026-01-01T10:00:00Z'), id: 'uuid-cur' },
        limit: 10,
      });

      expect(mockDb.selectRows).toHaveBeenCalledOnce();
      const [, , sql, params] = mockDb.selectRows.mock.calls[0]!;

      expect(sql).toContain('INNER JOIN heroes h ON h.id = page_ids.id');
      expect(sql).toContain("name LIKE ? ESCAPE '\\\\'");
      expect(sql).toContain('created_at < ? OR (created_at = ? AND id < ?)');
      expect(params).toEqual([
        '%Hulk\\%Special\\_%',
        '%Hulk\\%Special\\_%',
        new Date('2026-01-01T10:00:00Z'),
        new Date('2026-01-01T10:00:00Z'),
        'uuid-cur',
        10,
      ]);
    });
  });

  describe('findNicknames', () => {
    it('should return empty Map when ids array is empty without querying', async () => {
      const map = await repo.findNicknames([]);
      expect(map.size).toBe(0);
      expect(mockDb.selectRows).not.toHaveBeenCalled();
    });

    it('should return map of id to nickname', async () => {
      mockDb.selectRows.mockResolvedValueOnce([
        { id: '1', nickname: 'Hulk' },
        { id: '2', nickname: 'Thor' },
      ]);

      const map = await repo.findNicknames(['1', '2']);
      expect(map.get('1')).toBe('Hulk');
      expect(map.get('2')).toBe('Thor');
    });
  });
});
