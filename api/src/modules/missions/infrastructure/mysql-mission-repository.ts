import { randomUUID } from 'node:crypto';
import type { Pool } from 'mysql2/promise';
import { z } from 'zod';
import {
  connectionOf,
  duplicateKeyName,
  execute,
  selectRows,
  type Db,
} from '../../../shared/infra/db.js';
import type { Tx } from '../../../shared/kernel/types.js';
import { toHeroId, type HeroId } from '../../heroes/index.js';
import {
  MISSION_STATUSES,
  toMissionId,
  type MissionCreateInput,
  type MissionId,
  type MissionStatus,
} from '../domain/mission.js';
import type { MissionListQuery, MissionRecord, MissionRepository } from '../application/ports.js';

const missionRowSchema = z.object({
  id: z.string().transform(toMissionId),
  title: z.string(),
  starts_at: z.date(),
  ends_at: z.date(),
  status: z.enum(MISSION_STATUSES),
});

const rosterRowSchema = z.object({
  mission_id: z.string().transform(toMissionId),
  hero_id: z.string().transform(toHeroId),
});

export class MysqlMissionRepository implements MissionRepository {
  constructor(private readonly pool: Pool) {}

  async insert(input: MissionCreateInput): Promise<MissionRecord> {
    const id = toMissionId(randomUUID());
    const now = new Date();
    await execute(
      this.pool,
      'INSERT INTO missions (id, title, starts_at, ends_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, input.title, input.starts_at, input.ends_at, 'scheduled', now, now],
    );
    return {
      id,
      title: input.title,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      status: 'scheduled',
      heroIds: [],
    };
  }

  async findById(id: MissionId): Promise<MissionRecord | null> {
    return this.selectOne(this.pool, id, false);
  }

  async lockById(tx: Tx, id: MissionId): Promise<MissionRecord | null> {
    return this.selectOne(connectionOf(tx), id, true);
  }

  async list(query: MissionListQuery): Promise<readonly MissionRecord[]> {
    const conditions: string[] = ['1 = 1'];
    const params: unknown[] = [];

    if (query.status) {
      conditions.push('m.status = ?');
      params.push(query.status);
    }
    if (query.heroId) {
      conditions.push('EXISTS (SELECT 1 FROM mission_heroes mh WHERE mh.mission_id = m.id AND mh.hero_id = ?)');
      params.push(query.heroId);
    }
    if (query.after) {
      conditions.push('(m.starts_at < ? OR (m.starts_at = ? AND m.id < ?))');
      params.push(query.after.at, query.after.at, query.after.id);
    }
    params.push(query.limit);

    const rows = await selectRows(
      this.pool,
      missionRowSchema,
      `SELECT m.id, m.title, m.starts_at, m.ends_at, m.status
       FROM missions m
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.starts_at DESC, m.id DESC
       LIMIT ?`,
      params,
    );
    return this.attachRosters(this.pool, rows);
  }

  async findOverlappingActiveMission(
    tx: Tx,
    heroId: HeroId,
    startsAt: Date,
    endsAt: Date,
  ): Promise<MissionRecord | null> {
    const conn = connectionOf(tx);
    const rows = await selectRows(
      conn,
      missionRowSchema,
      `SELECT m.id, m.title, m.starts_at, m.ends_at, m.status
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
    return { ...first, heroIds: [heroId] };
  }

  async addHero(tx: Tx, missionId: MissionId, heroId: HeroId): Promise<'added' | 'already_assigned'> {
    try {
      await execute(
        connectionOf(tx),
        'INSERT INTO mission_heroes (mission_id, hero_id, assigned_at) VALUES (?, ?, ?)',
        [missionId, heroId, new Date()],
      );
      return 'added';
    } catch (error: unknown) {
      if (duplicateKeyName(error) !== null) return 'already_assigned';
      throw error;
    }
  }

  async removeHero(tx: Tx, missionId: MissionId, heroId: HeroId): Promise<boolean> {
    const result = await execute(
      connectionOf(tx),
      'DELETE FROM mission_heroes WHERE mission_id = ? AND hero_id = ?',
      [missionId, heroId],
    );
    return result.affectedRows > 0;
  }

  async updateStatus(tx: Tx, missionId: MissionId, status: MissionStatus): Promise<void> {
    await execute(
      connectionOf(tx),
      'UPDATE missions SET status = ?, updated_at = ? WHERE id = ?',
      [status, new Date(), missionId],
    );
  }

  private async selectOne(db: Db, id: MissionId, lock: boolean): Promise<MissionRecord | null> {
    const suffix = lock ? ' FOR UPDATE' : '';
    const rows = await selectRows(
      db,
      missionRowSchema,
      `SELECT id, title, starts_at, ends_at, status FROM missions WHERE id = ?${suffix}`,
      [id],
    );
    const attached = await this.attachRosters(db, rows);
    return attached[0] ?? null;
  }

  private async attachRosters(
    db: Db,
    missions: readonly z.output<typeof missionRowSchema>[],
  ): Promise<readonly MissionRecord[]> {
    if (missions.length === 0) return [];
    const ids = missions.map((mission) => mission.id);
    const rosterRows = await selectRows(
      db,
      rosterRowSchema,
      'SELECT mission_id, hero_id FROM mission_heroes WHERE mission_id IN (?) ORDER BY assigned_at ASC, hero_id ASC',
      [ids],
    );
    const byMission = new Map<MissionId, HeroId[]>();
    for (const row of rosterRows) {
      const list = byMission.get(row.mission_id) ?? [];
      list.push(row.hero_id);
      byMission.set(row.mission_id, list);
    }
    return missions.map((mission) => ({
      ...mission,
      heroIds: byMission.get(mission.id) ?? [],
    }));
  }
}

