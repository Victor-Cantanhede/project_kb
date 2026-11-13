import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MysqlMissionRepository } from './mysql-mission.repository.js';
import type { MysqlDatabaseService } from '../../../../core/database/mysql-database.service.js';
import { MysqlTransactionManager } from '../../../../core/database/mysql-transaction.manager.js';
import type { HeroFacadeService } from '../../../heroes/index.js';

describe('MysqlMissionRepository', () => {
  let mockDb: {
    getPool: ReturnType<typeof vi.fn>;
    selectRows: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
  };
  let mockHeroFacade: {
    findNicknames: ReturnType<typeof vi.fn>;
  };
  let repo: MysqlMissionRepository;
  let txManager: MysqlTransactionManager;
  let mockConnection: {
    query: ReturnType<typeof vi.fn>;
    beginTransaction: ReturnType<typeof vi.fn>;
    commit: ReturnType<typeof vi.fn>;
    rollback: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockConnection = {
      query: vi.fn().mockResolvedValue([]),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    };

    mockDb = {
      getPool: vi.fn().mockReturnValue({}),
      selectRows: vi.fn(),
      execute: vi.fn(),
    };
    mockHeroFacade = {
      findNicknames: vi.fn().mockResolvedValue(new Map()),
    };
    repo = new MysqlMissionRepository(
      mockDb as unknown as MysqlDatabaseService,
      mockHeroFacade as unknown as HeroFacadeService,
    );
    txManager = new MysqlTransactionManager({
      getConnection: vi.fn().mockResolvedValue(mockConnection),
      getPool: vi.fn().mockReturnValue({}),
    } as unknown as MysqlDatabaseService);
  });

  describe('insert', () => {
    it('should insert a new mission with status scheduled and return entity', async () => {
      mockDb.execute.mockResolvedValueOnce({ affectedRows: 1 });
      const input = {
        title: 'Operação Budapeste',
        starts_at: new Date('2026-11-03T10:00:00.000Z'),
        ends_at: new Date('2026-11-03T12:00:00.000Z'),
      };

      const mission = await repo.insert(input);

      expect(mission.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(mission.title).toBe(input.title);
      expect(mission.status).toBe('scheduled');
      expect(mission.heroes).toEqual([]);
      expect(mockDb.execute).toHaveBeenCalledOnce();
      expect(mockDb.execute.mock.calls[0]![1]).toContain('INSERT INTO missions');
    });
  });

  describe('findById and lockById', () => {
    const missionId = '00000000-0000-4000-8000-000000000001';
    const heroId = '00000000-0000-4000-8000-000000000002';

    it('should find mission by ID and hydrate roster with nicknames', async () => {
      mockDb.selectRows
        .mockResolvedValueOnce([
          {
            id: missionId,
            title: 'Operação Budapeste',
            starts_at: new Date('2026-11-03T10:00:00.000Z'),
            ends_at: new Date('2026-11-03T12:00:00.000Z'),
            status: 'scheduled',
          },
        ])
        .mockResolvedValueOnce([
          {
            mission_id: missionId,
            hero_id: heroId,
          },
        ]);
      mockHeroFacade.findNicknames.mockResolvedValueOnce(
        new Map([[heroId, 'Viúva Negra']]),
      );

      const mission = await repo.findById(missionId);

      expect(mission).not.toBeNull();
      expect(mission?.id).toBe(missionId);
      expect(mission?.heroes).toEqual([{ id: heroId, nickname: 'Viúva Negra' }]);
      expect(mockHeroFacade.findNicknames).toHaveBeenCalledWith([heroId]);
    });

    it('should return null when mission does not exist', async () => {
      mockDb.selectRows.mockResolvedValueOnce([]);

      const mission = await repo.findById('non-existent');
      expect(mission).toBeNull();
    });

    it('should lock mission by ID with FOR UPDATE', async () => {
      await txManager.run(async (tx) => {
        mockDb.selectRows
          .mockResolvedValueOnce([
            {
              id: missionId,
              title: 'Operação Budapeste',
              starts_at: new Date('2026-11-03T10:00:00.000Z'),
              ends_at: new Date('2026-11-03T12:00:00.000Z'),
              status: 'scheduled',
            },
          ])
          .mockResolvedValueOnce([]);

        const mission = await repo.lockById(tx, missionId);

        expect(mission).not.toBeNull();
        const firstCallSql = mockDb.selectRows.mock.calls[0]![2];
        expect(firstCallSql).toContain('FOR UPDATE');
      });
    });
  });

  describe('list', () => {
    it('should query missions with filters and hydrate rosters', async () => {
      mockDb.selectRows
        .mockResolvedValueOnce([
          {
            id: 'm-1',
            title: 'Missão 1',
            starts_at: new Date('2026-11-03T10:00:00.000Z'),
            ends_at: new Date('2026-11-03T12:00:00.000Z'),
            status: 'scheduled',
          },
        ])
        .mockResolvedValueOnce([]);

      const missions = await repo.list({
        status: 'scheduled',
        heroId: 'hero-1',
        after: { at: new Date('2026-11-03T12:00:00.000Z'), id: 'm-0' },
        limit: 10,
      });

      expect(missions).toHaveLength(1);
      const sql = mockDb.selectRows.mock.calls[0]![2];
      expect(sql).toContain('m.status = ?');
      expect(sql).toContain('EXISTS (SELECT 1 FROM mission_heroes');
      expect(sql).toContain('m.starts_at < ?');
    });

    it('should return empty list when no rows returned', async () => {
      mockDb.selectRows.mockResolvedValueOnce([]);

      const missions = await repo.list({ limit: 10 });
      expect(missions).toEqual([]);
    });
  });

  describe('findOverlappingActiveMission', () => {
    it('should return overlapping active mission if exists', async () => {
      await txManager.run(async (tx) => {
        mockDb.selectRows.mockResolvedValueOnce([
          {
            id: 'm-conflict',
            title: 'Missão Conflitante',
            starts_at: new Date('2026-11-03T10:00:00.000Z'),
            ends_at: new Date('2026-11-03T12:00:00.000Z'),
            status: 'in_progress',
          },
        ]);

        const conflict = await repo.findOverlappingActiveMission(
          tx,
          'hero-1',
          new Date('2026-11-03T11:00:00.000Z'),
          new Date('2026-11-03T13:00:00.000Z'),
        );

        expect(conflict).not.toBeNull();
        expect(conflict?.id).toBe('m-conflict');
        expect(conflict?.title).toBe('Missão Conflitante');
      });
    });

    it('should return null when there is no overlapping mission', async () => {
      await txManager.run(async (tx) => {
        mockDb.selectRows.mockResolvedValueOnce([]);

        const conflict = await repo.findOverlappingActiveMission(
          tx,
          'hero-1',
          new Date('2026-11-03T10:00:00.000Z'),
          new Date('2026-11-03T12:00:00.000Z'),
        );

        expect(conflict).toBeNull();
      });
    });
  });

  describe('addHero, removeHero, updateStatus', () => {
    it('should return added when insert succeeds', async () => {
      await txManager.run(async (tx) => {
        mockDb.execute.mockResolvedValueOnce({ affectedRows: 1 });

        const result = await repo.addHero(tx, 'm-1', 'h-1');
        expect(result).toBe('added');
      });
    });

    it('should return already_assigned on duplicate key', async () => {
      await txManager.run(async (tx) => {
        const dupError = {
          code: 'ER_DUP_ENTRY',
          sqlMessage: "Duplicate entry 'm-1-h-1' for key 'PRIMARY'",
        };
        mockDb.execute.mockRejectedValueOnce(dupError);

        const result = await repo.addHero(tx, 'm-1', 'h-1');
        expect(result).toBe('already_assigned');
      });
    });

    it('should return true when removeHero deletes row', async () => {
      await txManager.run(async (tx) => {
        mockDb.execute.mockResolvedValueOnce({ affectedRows: 1 });

        const removed = await repo.removeHero(tx, 'm-1', 'h-1');
        expect(removed).toBe(true);
      });
    });

    it('should return false when removeHero matches 0 rows', async () => {
      await txManager.run(async (tx) => {
        mockDb.execute.mockResolvedValueOnce({ affectedRows: 0 });

        const removed = await repo.removeHero(tx, 'm-1', 'h-1');
        expect(removed).toBe(false);
      });
    });

    it('should update mission status', async () => {
      await txManager.run(async (tx) => {
        mockDb.execute.mockResolvedValueOnce({ affectedRows: 1 });

        await repo.updateStatus(tx, 'm-1', 'in_progress');
        expect(mockDb.execute).toHaveBeenCalledOnce();
        expect(mockDb.execute.mock.calls[0]![1]).toContain(
          'UPDATE missions SET status = ?',
        );
      });
    });
  });
});
