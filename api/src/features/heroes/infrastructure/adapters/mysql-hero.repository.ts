import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  duplicateKeyName,
  MysqlDatabaseService,
} from '../../../../core/database/mysql-database.service.js';
import {
  connectionOf,
  type Tx,
} from '../../../../core/database/mysql-transaction.manager.js';
import { HeroEntity } from '../../domain/entities/hero.entity.js';
import { HeroHistoryEntity } from '../../domain/entities/hero-history.entity.js';
import type { HeroChange } from '../../domain/utils/hero-diff.util.js';
import type {
  HeroBatchInsertInput,
  HeroCreateInput,
  HeroListQuery,
  HeroUpdateInput,
  HistoryQuery,
  IdempotentCreation,
  IHeroRepository,
  InsertOutcome,
} from '../../domain/ports/hero-repository.port.js';

const heroRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  nickname: z.string(),
  date_of_birth: z.string(),
  universe: z.string(),
  main_power: z.string(),
  avatar_url: z.string().nullable(),
  is_active: z.union([z.boolean(), z.number()]).transform(Boolean),
  version: z.coerce.number(),
  created_at: z.union([z.date(), z.string()]).transform((val) => new Date(val)),
  updated_at: z.union([z.date(), z.string()]).transform((val) => new Date(val)),
  deleted_at: z
    .union([z.date(), z.string(), z.null()])
    .optional()
    .transform((val) => (val ? new Date(val) : null)),
});

const idempotentRowSchema = heroRowSchema.extend({
  deleted_at: z
    .union([z.date(), z.string(), z.null()])
    .optional()
    .transform((val) => (val ? new Date(val) : null)),
  idempotency_hash: z.string().nullable(),
});

const historyRowSchema = z.object({
  id: z.coerce.string(),
  hero_id: z.string(),
  field: z.string(),
  old_value: z.string().nullable(),
  new_value: z.string().nullable(),
  changed_at: z.union([z.date(), z.string()]).transform((val) => new Date(val)),
});

const nicknameRowSchema = z.object({
  id: z.string(),
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

@Injectable()
export class MysqlHeroRepository implements IHeroRepository {
  constructor(
    @Inject(MysqlDatabaseService)
    private readonly db: MysqlDatabaseService,
  ) {}

  async insert(
    input: HeroCreateInput,
    idempotency?: { readonly key: string | null; readonly hash: string | null },
  ): Promise<InsertOutcome> {
    const id = randomUUID();
    const now = new Date();
    try {
      await this.db.execute(
        this.db.getPool(),
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
          input.avatar_url ?? null,
          idempotency?.key ?? null,
          idempotency?.hash ?? null,
          now,
          now,
        ],
      );
      return { kind: 'created', id };
    } catch (error: unknown) {
      const keyName = duplicateKeyName(error);
      if (keyName === 'uq_heroes_idempotency_key') {
        return { kind: 'duplicate_idempotency_key' };
      }
      if (keyName === 'uq_heroes_identity') {
        return { kind: 'duplicate_hero' };
      }
      throw error;
    }
  }

  async insertMany(inputs: readonly HeroBatchInsertInput[]): Promise<number> {
    if (inputs.length === 0) return 0;
    const now = new Date();
    const rows = inputs.map((item) => [
      item.id ?? randomUUID(),
      item.name,
      item.nickname,
      item.date_of_birth,
      item.universe,
      item.main_power,
      item.avatar_url ?? null,
      now,
      now,
    ]);

    const result = await this.db.execute(
      this.db.getPool(),
      `INSERT IGNORE INTO heroes (
        id, name, nickname, date_of_birth, universe, main_power, avatar_url, created_at, updated_at
      ) VALUES ?`,
      [rows],
    );
    return result.affectedRows;
  }

  async findById(id: string): Promise<HeroEntity | null> {
    const rows = await this.db.selectRows(
      this.db.getPool(),
      heroRowSchema,
      `SELECT ${HERO_COLUMNS} FROM heroes WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    const row = rows[0];
    return row ? new HeroEntity(row) : null;
  }

  async findByIdIncludingDeleted(id: string): Promise<HeroEntity | null> {
    const rows = await this.db.selectRows(
      this.db.getPool(),
      heroRowSchema,
      `SELECT ${HERO_COLUMNS}, deleted_at FROM heroes WHERE id = ?`,
      [id],
    );
    const row = rows[0];
    return row ? new HeroEntity(row) : null;
  }

  async findByIdempotencyKey(key: string): Promise<IdempotentCreation | null> {
    const rows = await this.db.selectRows(
      this.db.getPool(),
      idempotentRowSchema,
      `SELECT ${HERO_COLUMNS}, deleted_at, idempotency_hash FROM heroes WHERE idempotency_key = ?`,
      [key],
    );
    const row = rows[0];
    if (!row || !row.idempotency_hash) return null;
    if (row.deleted_at !== null) {
      return { hero: null, requestHash: row.idempotency_hash };
    }
    const { deleted_at: _deletedAt, idempotency_hash: requestHash, ...heroProps } = row;
    return { hero: new HeroEntity(heroProps), requestHash };
  }

  async list(query: HeroListQuery): Promise<HeroEntity[]> {
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

    const rows = await this.db.selectRows(this.db.getPool(), heroRowSchema, sql, params);
    return rows.map((row) => new HeroEntity(row));
  }

  async findNicknames(ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db.selectRows(
      this.db.getPool(),
      nicknameRowSchema,
      'SELECT id, nickname FROM heroes WHERE id IN (?)',
      [ids],
    );
    return new Map(rows.map((row) => [row.id, row.nickname]));
  }

  async lockById(tx: Tx, id: string): Promise<HeroEntity | null> {
    const conn = connectionOf(tx);
    const rows = await this.db.selectRows(
      conn,
      heroRowSchema,
      `SELECT ${HERO_COLUMNS} FROM heroes WHERE id = ? AND deleted_at IS NULL FOR UPDATE`,
      [id],
    );
    const row = rows[0];
    return row ? new HeroEntity(row) : null;
  }

  async update(
    tx: Tx,
    id: string,
    updates: HeroUpdateInput,
    changes?: readonly HeroChange[],
  ): Promise<'updated' | 'duplicate_hero'> {
    const conn = connectionOf(tx);
    const now = new Date();
    const assignments: string[] = ['version = version + 1', 'updated_at = ?'];
    const params: unknown[] = [now];

    for (const [column, value] of Object.entries(updates)) {
      if (value !== undefined) {
        assignments.push(`${column} = ?`);
        params.push(value);
      }
    }
    params.push(id);

    try {
      await this.db.execute(
        conn,
        `UPDATE heroes SET ${assignments.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
        params,
      );
    } catch (error: unknown) {
      if (duplicateKeyName(error) === 'uq_heroes_identity') {
        return 'duplicate_hero';
      }
      throw error;
    }

    if (changes && changes.length > 0) {
      const historyRows = changes.map((change) => [
        id,
        change.field,
        change.old_value,
        change.new_value,
        now,
      ]);
      await this.db.execute(
        conn,
        'INSERT INTO hero_history (hero_id, field, old_value, new_value, changed_at) VALUES ?',
        [historyRows],
      );
    }

    return 'updated';
  }

  async softDelete(tx: Tx, id: string): Promise<void> {
    const conn = connectionOf(tx);
    const now = new Date();
    await this.db.execute(
      conn,
      'UPDATE heroes SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      [now, now, id],
    );
  }

  async listHistory(heroId: string, query: HistoryQuery): Promise<HeroHistoryEntity[]> {
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

    const sql = `
      SELECT id, hero_id, field, old_value, new_value, changed_at
      FROM hero_history
      WHERE ${conditions.join(' AND ')}
      ORDER BY id DESC
      LIMIT ?
    `;

    const rows = await this.db.selectRows(this.db.getPool(), historyRowSchema, sql, params);
    return rows.map((row) => new HeroHistoryEntity(row));
  }
}
