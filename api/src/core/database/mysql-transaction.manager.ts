import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool, PoolConnection } from 'mysql2/promise';
import { MysqlDatabaseService } from './mysql-database.service.js';

declare const txBrand: unique symbol;

/** Opaque handle to an open unit of work. Only infrastructure knows what is inside. */
export type Tx = { readonly [txBrand]: 'Tx' };

export interface TransactionManager {
  run<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
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
@Injectable()
export class MysqlTransactionManager implements TransactionManager {
  private readonly dbService?: MysqlDatabaseService;
  private readonly pool?: Pool;

  constructor(
    @Optional()
    @Inject(MysqlDatabaseService)
    poolOrDbService?: Pool | MysqlDatabaseService,
  ) {
    if (poolOrDbService && 'getConnection' in poolOrDbService && 'getPool' in poolOrDbService) {
      this.dbService = poolOrDbService as MysqlDatabaseService;
    } else if (poolOrDbService) {
      this.pool = poolOrDbService as Pool;
    }
  }

  private async getConnection(): Promise<PoolConnection> {
    if (this.dbService) {
      return this.dbService.getConnection();
    }
    if (this.pool) {
      return this.pool.getConnection();
    }
    throw new Error('MysqlTransactionManager: nenhum Pool ou MysqlDatabaseService fornecido.');
  }

  async run<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    const connection = await this.getConnection();
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

  connectionOf(tx: Tx): PoolConnection {
    return connectionOf(tx);
  }
}
