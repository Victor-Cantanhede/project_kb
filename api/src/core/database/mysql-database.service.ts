import { Inject, Injectable, type OnModuleDestroy, Optional } from '@nestjs/common';
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import type { z } from 'zod';
import { MYSQL_POOL_TOKEN } from './database.tokens.js';

export type Db = Pool | PoolConnection;

export function createPool(url: string, connectionLimit = 10): Pool {
  return mysql.createPool({
    uri: url,
    connectionLimit,
    timezone: 'Z', // DATETIME columns hold UTC
    dateStrings: ['DATE'], // a birth date is a day, never shifted by a timezone
    supportBigNumbers: true,
  });
}

export interface MysqlError {
  readonly code: string;
  readonly sqlMessage?: string;
}

export function isMysqlError(error: unknown): error is MysqlError {
  return typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code: unknown }).code === 'string';
}

/** Name of the unique key that rejected an insert/update, or null for any other error. */
export function duplicateKeyName(error: unknown): string | null {
  if (!isMysqlError(error) || error.code !== 'ER_DUP_ENTRY') return null;
  return /for key '(?:[^.']+\.)?([^']+)'/.exec(error.sqlMessage ?? '')?.[1] ?? '';
}

/** Every row read from MySQL is validated, so repositories never touch untyped data. */
export async function selectRows<S extends z.ZodType>(
  db: Db,
  schema: S,
  sql: string,
  values: readonly unknown[] = [],
): Promise<Array<z.output<S>>> {
  const [rows] = await db.query<RowDataPacket[]>(sql, [...values]);
  return rows.map((row) => schema.parse(row));
}

export async function execute(db: Db, sql: string, values: readonly unknown[] = []): Promise<ResultSetHeader> {
  const [result] = await db.query<ResultSetHeader>(sql, [...values]);
  return result;
}

@Injectable()
export class MysqlDatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;
  private readonly isExternalPool: boolean;

  constructor(@Optional() @Inject(MYSQL_POOL_TOKEN) injectedPool?: Pool | null) {
    if (injectedPool) {
      this.pool = injectedPool;
      this.isExternalPool = true;
    } else {
      const url = process.env.DATABASE_URL ?? 'mysql://hero:hero@localhost:3306/hero_factory';
      this.pool = createPool(url);
      this.isExternalPool = false;
    }
  }

  getPool(): Pool {
    return this.pool;
  }

  async getConnection(): Promise<PoolConnection> {
    return this.pool.getConnection();
  }

  async selectRows<S extends z.ZodType>(
    db: Db,
    schema: S,
    sql: string,
    values: readonly unknown[] = [],
  ): Promise<Array<z.output<S>>> {
    return selectRows(db, schema, sql, values);
  }

  async execute(db: Db, sql: string, values: readonly unknown[] = []): Promise<ResultSetHeader> {
    return execute(db, sql, values);
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.isExternalPool) {
      try {
        await this.pool.end();
      } catch {
        // Pool already closed or closing
      }
    }
  }
}
