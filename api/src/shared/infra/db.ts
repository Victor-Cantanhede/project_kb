import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import type { z } from 'zod';
import type { TransactionManager, Tx } from '../kernel/types.js';

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

const connections = new WeakMap<Tx, PoolConnection>();

export function connectionOf(tx: Tx): PoolConnection {
  const connection = connections.get(tx);
  if (!connection) throw new Error('Transação já encerrada.');
  return connection;
}

/**
 * READ COMMITTED: a query run after a row lock is granted sees what the lock holder committed.
 * That is what makes "lock hero, then check schedule" safe across API instances.
 */
export class MysqlTransactionManager implements TransactionManager {
  constructor(private readonly pool: Pool) {}

  async run<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    const tx = Object.freeze({}) as Tx; // branded constructor: the token's identity is the WeakMap key
    connections.set(tx, connection);
    try {
      await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
      await connection.beginTransaction();
      const result = await work(tx);
      await connection.commit();
      return result;
    } catch (error: unknown) {
      await connection.rollback();
      throw error;
    } finally {
      connections.delete(tx);
      connection.release();
    }
  }
}

interface MysqlError {
  readonly code: string;
  readonly sqlMessage?: string;
}

export function isMysqlError(error: unknown): error is MysqlError {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string';
}

/** Name of the unique key that rejected an insert/update, or null for any other error. */
export function duplicateKeyName(error: unknown): string | null {
  if (!isMysqlError(error) || error.code !== 'ER_DUP_ENTRY') return null;
  return /for key '(?:[^.']+\.)?([^']+)'/.exec(error.sqlMessage ?? '')?.[1] ?? '';
}

