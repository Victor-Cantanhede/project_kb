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
import {
  HISTORY_FIELDS,
  toHeroId,
  type Hero,
  type HeroChange,
  type HeroCreateInput,
  type HeroId,
} from '../domain/hero.js';
import type {
  HeroHistoryEntry,
  HeroListQuery,
  HeroRepository,
  HeroUpdate,
  HistoryQuery,
  IdempotentCreation,
  InsertOutcome,
} from '../application/ports.js';

const heroRowSchema = z.object({
  id: z.string().transform(toHeroId),
  name: z.string(),
  nickname: z.string(),
  date_of_birth: z.string(),
  universe: z.string(),
  main_power: z.string(),
  avatar_url: z.string().nullable(),
  is_active: z.union([z.boolean(), z.number()]).transform(Boolean),
  version: z.coerce.number(),
  created_at: z.date(),
  updated_at: z.date(),
});

const idempotentRowSchema = heroRowSchema.extend({
  deleted_at: z.date().nullable(),
  idempotency_hash: z.string().nullable(),
});

const historyRowSchema = z.object({
  id: z.coerce.string(),
  field: z.enum(HISTORY_FIELDS),
  old_value: z.string().nullable(),
  new_value: z.string().nullable(),
  changed_at: z.date(),
});

const nicknameRowSchema = z.object({
  id: z.string().transform(toHeroId),
  nickname: z.string(),
});

const HERO_COLUMNS =
  'id, name, nickname, date_of_birth, universe, main_power, avatar_url, is_active, version, created_at, updated_at';

const HERO_COLUMNS_ALIASED = HERO_COLUMNS.split(', ')
  .map((col) => `h.${col}`)
  .join(', ');

function escapeLikePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export class MysqlHeroRepository implements HeroRepository {
  constructor(private readonly pool: Pool) {}

  async insert(
    input: HeroCreateInput,
    idempotency: { readonly key: string | null; readonly hash: string | null },
  ): Promise<InsertOutcome> {
    const id = toHeroId(randomUUID());
    const now = new Date();
    try {
      await execute(
        this.pool,
        `INSERT INTO heroes (
          id, name, nickname, date_of_birth, universe, main_power, avatar_url,
          is_active, version, idempotency_key, idempotency_hash, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, 1, ?, ?, ?, ?)`,
        [
          id,
          input.name,
          input.nickname,
          input.date_of_birth,
          input.universe,
          input.main_power,
          input.avatar_url,
          idempotency.key,
          idempotency.hash,
          now,
          now,
        ],
      );
      return { kind: 'created', id };
    } catch (error: unknown) {
      const keyName = duplicateKeyName(error);
      if (keyName === 'uq_heroes_idempotency_key') return { kind: 'duplicate_idempotency_key' };
      if (keyName === 'uq_heroes_identity') return { kind: 'duplicate_hero' };
      throw error;
    }
  }

  async insertMany(inputs: readonly HeroCreateInput[]): Promise<number> {
    if (inputs.length === 0) return 0;
    const now = new Date();
    const rows = inputs.map((item) => [
      randomUUID(),
      item.name,
      item.nickname,
      item.date_of_birth,
      item.universe,
      item.main_power,
      item.avatar_url,
      now,
      now,
    ]);
    const result = await execute(
      this.pool,
      `INSERT IGNORE INTO heroes (
        id, name, nickname, date_of_birth, universe, main_power, avatar_url, created_at, updated_at
      ) VALUES ?`,
      [rows],
    );
    return result.affectedRows;
  }

  async findById(id: HeroId): Promise<Hero | null> {
    return this.selectOne(this.pool, id, false);
  }

  async findByIdempotencyKey(key: string): Promise<IdempotentCreation | null> {
    const rows = await selectRows(
      this.pool,
      idempotentRowSchema,
      `SELECT ${HERO_COLUMNS}, deleted_at, idempotency_hash FROM heroes WHERE idempotency_key = ?`,
      [key],
    );
    const row = rows[0];
    if (!row || !row.idempotency_hash) return null;
    if (row.deleted_at !== null) {
      return { hero: null, requestHash: row.idempotency_hash };
    }
    const { deleted_at: _deletedAt, idempotency_hash: requestHash, ...hero } = row;
    return { hero, requestHash };
  }

  async list(query: HeroListQuery): Promise<readonly Hero[]> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (query.search) {
      const pattern = escapeLikePattern(query.search);
      conditions.push("(name LIKE ? ESCAPE '\\\\' OR nickname LIKE ? ESCAPE '\\\\')");
      params.push(pattern, pattern);
    }

    if (query.after) {
      conditions.push('(created_at < ? OR (created_at = ? AND id < ?))');
      params.push(query.after.at, query.after.at, query.after.id);
    }

    params.push(query.limit);
    const sql = `
      SELECT ${HERO_COLUMNS_ALIASED}
      FROM (
        SELECT id FROM heroes
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      ) AS page_ids
      INNER JOIN heroes h ON h.id = page_ids.id
      ORDER BY h.created_at DESC, h.id DESC
    `;
    return selectRows(this.pool, heroRowSchema, sql, params);
  }

  async findNicknames(ids: readonly HeroId[]): Promise<ReadonlyMap<HeroId, string>> {
    if (ids.length === 0) return new Map();
    const rows = await selectRows(
      this.pool,
      nicknameRowSchema,
      'SELECT id, nickname FROM heroes WHERE id IN (?)',
      [ids],
    );
    return new Map(rows.map((row) => [row.id, row.nickname]));
  }

  async lockById(tx: Tx, id: HeroId): Promise<Hero | null> {
    return this.selectOne(connectionOf(tx), id, true);
  }

  async update(
    tx: Tx,
    id: HeroId,
    values: HeroUpdate,
    changes: readonly HeroChange[],
  ): Promise<'updated' | 'duplicate_hero'> {
    const conn = connectionOf(tx);
    const now = new Date();
    const assignments: string[] = ['version = version + 1', 'updated_at = ?'];
    const params: unknown[] = [now];

    for (const [column, value] of Object.entries(values)) {
      if (value !== undefined) {
        assignments.push(`${column} = ?`);
        params.push(value);
      }
    }
    params.push(id);

    try {
      await execute(conn, `UPDATE heroes SET ${assignments.join(', ')} WHERE id = ? AND deleted_at IS NULL`, params);
    } catch (error: unknown) {
      if (duplicateKeyName(error) === 'uq_heroes_identity') return 'duplicate_hero';
      throw error;
    }

    if (changes.length > 0) {
      const historyRows = changes.map((change) => [id, change.field, change.old_value, change.new_value, now]);
      await execute(
        conn,
        'INSERT INTO hero_history (hero_id, field, old_value, new_value, changed_at) VALUES ?',
        [historyRows],
      );
    }
    return 'updated';
  }

  async softDelete(tx: Tx, id: HeroId): Promise<void> {
    const now = new Date();
    await execute(
      connectionOf(tx),
      'UPDATE heroes SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      [now, now, id],
    );
  }

  async listHistory(heroId: HeroId, query: HistoryQuery): Promise<readonly HeroHistoryEntry[]> {
    const conditions: string[] = ['hero_id = ?'];
    const params: unknown[] = [heroId];

    if (query.field) {
      conditions.push('field = ?');
      params.push(query.field);
    }
    if (query.after) {
      conditions.push('id < ?');
      params.push(query.after.id);
    }
    params.push(query.limit);
    const sql = `SELECT id, field, old_value, new_value, changed_at FROM hero_history WHERE ${conditions.join(' AND ')} ORDER BY id DESC LIMIT ?`;
    return selectRows(this.pool, historyRowSchema, sql, params);
  }

  private async selectOne(db: Db, id: HeroId, lock: boolean): Promise<Hero | null> {
    const suffix = lock ? ' FOR UPDATE' : '';
    const rows = await selectRows(
      db,
      heroRowSchema,
      `SELECT ${HERO_COLUMNS} FROM heroes WHERE id = ? AND deleted_at IS NULL${suffix}`,
      [id],
    );
    return rows[0] ?? null;
  }
}

