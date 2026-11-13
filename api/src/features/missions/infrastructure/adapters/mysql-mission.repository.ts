import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  type Db,
  duplicateKeyName,
  MysqlDatabaseService,
} from '../../../../core/database/mysql-database.service.js';
import {
  connectionOf,
  type Tx,
} from '../../../../core/database/mysql-transaction.manager.js';
import { HeroFacadeService } from '../../../heroes/index.js';
import {
  MISSION_STATUSES,
  MissionEntity,
  type MissionHeroSummary,
  type MissionStatus,
} from '../../domain/entities/mission.entity.js';
import type {
  IMissionRepository,
  MissionCreateInput,
  MissionListQuery,
} from '../../domain/ports/mission-repository.port.js';

const missionRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  starts_at: z
    .union([z.date(), z.string()])
    .transform((val) => new Date(val)),
  ends_at: z
    .union([z.date(), z.string()])
    .transform((val) => new Date(val)),
  status: z.enum(MISSION_STATUSES),
  created_at: z
    .union([z.date(), z.string()])
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  updated_at: z
    .union([z.date(), z.string()])
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
});

const rosterRowSchema = z.object({
  mission_id: z.string(),
  hero_id: z.string(),
});

type MissionRow = z.output<typeof missionRowSchema>;

@Injectable()
export class MysqlMissionRepository implements IMissionRepository {
  constructor(
    @Inject(MysqlDatabaseService)
    private readonly db: MysqlDatabaseService,
    @Inject(HeroFacadeService)
    private readonly heroFacade: HeroFacadeService,
  ) {}

  async insert(input: MissionCreateInput): Promise<MissionEntity> {
    const id = randomUUID();
    const now = new Date();
    await this.db.execute(
      this.db.getPool(),
      `INSERT INTO missions (id, title, starts_at, ends_at, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'scheduled', ?, ?)`,
      [id, input.title, input.starts_at, input.ends_at, now, now],
    );

    return new MissionEntity({
      id,
      title: input.title,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      status: 'scheduled',
      heroes: [],
      created_at: now,
      updated_at: now,
    });
  }

  async findById(id: string): Promise<MissionEntity | null> {
    return this.selectOne(this.db.getPool(), id, false);
  }

  async lockById(tx: Tx, id: string): Promise<MissionEntity | null> {
    return this.selectOne(connectionOf(tx), id, true);
  }

  async list(query: MissionListQuery): Promise<MissionEntity[]> {
    const conditions: string[] = ['1 = 1'];
    const params: unknown[] = [];

    if (query.status) {
      conditions.push('m.status = ?');
      params.push(query.status);
    }

    if (query.heroId) {
      conditions.push(
        'EXISTS (SELECT 1 FROM mission_heroes mh WHERE mh.mission_id = m.id AND mh.hero_id = ?)',
      );
      params.push(query.heroId);
    }

    if (query.after) {
      conditions.push('(m.starts_at < ? OR (m.starts_at = ? AND m.id < ?))');
      params.push(query.after.at, query.after.at, query.after.id);
    }

    params.push(query.limit);

    const sql = `
      SELECT m.id, m.title, m.starts_at, m.ends_at, m.status, m.created_at, m.updated_at
      FROM missions m
      WHERE ${conditions.join(' AND ')}
      ORDER BY m.starts_at DESC, m.id DESC
      LIMIT ?
    `;

    const rows = await this.db.selectRows(
      this.db.getPool(),
      missionRowSchema,
      sql,
      params,
    );

    return this.attachRostersAndHydrate(this.db.getPool(), rows);
  }

  async findOverlappingActiveMission(
    tx: Tx,
    heroId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<MissionEntity | null> {
    const conn = connectionOf(tx);
    const rows = await this.db.selectRows(
      conn,
      missionRowSchema,
      `SELECT m.id, m.title, m.starts_at, m.ends_at, m.status, m.created_at, m.updated_at
       FROM mission_heroes mh
       INNER JOIN missions m ON m.id = mh.mission_id
       WHERE mh.hero_id = ?
         AND m.status IN ('scheduled', 'in_progress')
         AND m.starts_at < ?
         AND m.ends_at > ?
       LIMIT 1`,
      [heroId, endsAt, startsAt],
    );

    const first = rows[0];
    if (!first) return null;
    return new MissionEntity({
      ...first,
      heroes: [],
    });
  }

  async addHero(
    tx: Tx,
    missionId: string,
    heroId: string,
  ): Promise<'added' | 'already_assigned'> {
    const conn = connectionOf(tx);
    try {
      await this.db.execute(
        conn,
        'INSERT INTO mission_heroes (mission_id, hero_id, assigned_at) VALUES (?, ?, ?)',
        [missionId, heroId, new Date()],
      );
      return 'added';
    } catch (error: unknown) {
      if (duplicateKeyName(error) !== null) {
        return 'already_assigned';
      }
      throw error;
    }
  }

  async removeHero(
    tx: Tx,
    missionId: string,
    heroId: string,
  ): Promise<boolean> {
    const conn = connectionOf(tx);
    const result = await this.db.execute(
      conn,
      'DELETE FROM mission_heroes WHERE mission_id = ? AND hero_id = ?',
      [missionId, heroId],
    );
    return result.affectedRows > 0;
  }

  async updateStatus(
    tx: Tx,
    missionId: string,
    status: MissionStatus,
  ): Promise<void> {
    const conn = connectionOf(tx);
    await this.db.execute(
      conn,
      'UPDATE missions SET status = ?, updated_at = ? WHERE id = ?',
      [status, new Date(), missionId],
    );
  }

  private async selectOne(
    db: Db,
    id: string,
    lock: boolean,
  ): Promise<MissionEntity | null> {
    const suffix = lock ? ' FOR UPDATE' : '';
    const rows = await this.db.selectRows(
      db,
      missionRowSchema,
      `SELECT id, title, starts_at, ends_at, status, created_at, updated_at FROM missions WHERE id = ?${suffix}`,
      [id],
    );

    const first = rows[0];
    if (!first) return null;

    const hydrated = await this.attachRostersAndHydrate(db, [first]);
    return hydrated[0] ?? null;
  }

  private async attachRostersAndHydrate(
    db: Db,
    missions: readonly MissionRow[],
  ): Promise<MissionEntity[]> {
    if (missions.length === 0) return [];

    const missionIds = missions.map((m) => m.id);
    const rosterRows = await this.db.selectRows(
      db,
      rosterRowSchema,
      'SELECT mission_id, hero_id FROM mission_heroes WHERE mission_id IN (?) ORDER BY assigned_at ASC, hero_id ASC',
      [missionIds],
    );

    const uniqueHeroIds = Array.from(
      new Set(rosterRows.map((r) => r.hero_id)),
    );
    const nicknameMap = await this.heroFacade.findNicknames(uniqueHeroIds);

    const rosterByMission = new Map<string, MissionHeroSummary[]>();
    for (const row of rosterRows) {
      const list = rosterByMission.get(row.mission_id) ?? [];
      list.push({
        id: row.hero_id,
        nickname: nicknameMap.get(row.hero_id) ?? 'Herói desconhecido',
      });
      rosterByMission.set(row.mission_id, list);
    }

    return missions.map(
      (m) =>
        new MissionEntity({
          ...m,
          heroes: rosterByMission.get(m.id) ?? [],
        }),
    );
  }
}
