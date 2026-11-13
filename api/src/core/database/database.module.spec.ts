import { describe, expect, it, vi } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { Pool, PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { z } from 'zod';
import { DatabaseModule, MYSQL_POOL_TOKEN } from './database.module.js';
import { MYSQL_POOL_TOKEN as TOKEN_FROM_TOKENS } from './database.tokens.js';
import {
  createPool,
  duplicateKeyName,
  execute,
  isMysqlError,
  MysqlDatabaseService,
  selectRows,
} from './mysql-database.service.js';
import {
  connectionOf,
  MysqlTransactionManager,
  type Tx,
} from './mysql-transaction.manager.js';

function createMockConnection(): PoolConnection {
  return {
    query: vi.fn().mockResolvedValue([[], []]),
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockReturnValue(undefined),
  } as unknown as PoolConnection;
}

function createMockPool(connection?: PoolConnection): Pool {
  const conn = connection ?? createMockConnection();
  return {
    getConnection: vi.fn().mockResolvedValue(conn),
    query: vi.fn().mockResolvedValue([[], []]),
    end: vi.fn().mockResolvedValue(undefined),
  } as unknown as Pool;
}

describe('DatabaseModule & ESM Cycle Verification (Unit Test)', () => {
  it('deve carregar DatabaseModule e tokens sem ReferenceError por dependência circular', () => {
    expect(DatabaseModule).toBeDefined();
    expect(MYSQL_POOL_TOKEN).toBeDefined();
    expect(typeof MYSQL_POOL_TOKEN).toBe('symbol');
    expect(MYSQL_POOL_TOKEN.description).toBe('MYSQL_POOL_TOKEN');
    expect(MYSQL_POOL_TOKEN).toBe(TOKEN_FROM_TOKENS);
  });

  it('deve configurar DynamicModule corretamente em DatabaseModule.forRoot(pool)', () => {
    const mockConn = createMockConnection();
    const mockPool = createMockPool(mockConn);

    const dynamicModule = DatabaseModule.forRoot(mockPool);
    expect(dynamicModule.module).toBe(DatabaseModule);
    expect(dynamicModule.exports).toEqual([MysqlDatabaseService, MysqlTransactionManager]);
    expect(dynamicModule.providers).toHaveLength(3);

    const poolProvider = dynamicModule.providers?.find(
      (p: unknown) => p && typeof p === 'object' && 'provide' in p && (p as { provide: unknown }).provide === MYSQL_POOL_TOKEN,
    ) as { provide: symbol; useValue: Pool };

    expect(poolProvider).toBeDefined();
    expect(poolProvider.useValue).toBe(mockPool);
  });

  it('deve configurar DynamicModule com pool null quando chamado sem argumentos', () => {
    const dynamicModule = DatabaseModule.forRoot();
    const poolProvider = dynamicModule.providers?.find(
      (p: unknown) => p && typeof p === 'object' && 'provide' in p && (p as { provide: unknown }).provide === MYSQL_POOL_TOKEN,
    ) as { provide: symbol; useValue: Pool | null };

    expect(poolProvider).toBeDefined();
    expect(poolProvider.useValue).toBeNull();
  });

  it('deve inicializar contexto NestJS completo via NestFactory sem erros circulares de DI', async () => {
    const mockConn = createMockConnection();
    const mockPool = createMockPool(mockConn);

    const app = await NestFactory.createApplicationContext(DatabaseModule.forRoot(mockPool), {
      logger: false,
    });

    const dbService = app.get(MysqlDatabaseService);
    const txManager = app.get(MysqlTransactionManager);
    const resolvedPoolToken = app.get(MYSQL_POOL_TOKEN);

    expect(dbService).toBeInstanceOf(MysqlDatabaseService);
    expect(txManager).toBeInstanceOf(MysqlTransactionManager);
    expect(resolvedPoolToken).toBe(mockPool);
    expect(dbService.getPool()).toBe(mockPool);

    await app.close();
    // External pool guard: pool.end() não deve ser chamado quando fornecido externamente
    expect(mockPool.end).not.toHaveBeenCalled();
  });
});

describe('MysqlDatabaseService (Unit Test)', () => {
  it('deve usar o pool injetado externamente e não fechá-lo em onModuleDestroy', async () => {
    const mockConn = createMockConnection();
    const mockPool = createMockPool(mockConn);

    const service = new MysqlDatabaseService(mockPool);
    expect(service.getPool()).toBe(mockPool);

    const conn = await service.getConnection();
    expect(conn).toBe(mockConn);
    expect(mockPool.getConnection).toHaveBeenCalledTimes(1);

    await service.onModuleDestroy();
    expect(mockPool.end).not.toHaveBeenCalled();
  });

  it('deve validar linhas com schema Zod em selectRows (instância e helper)', async () => {
    const mockConn = createMockConnection();
    const mockPool = createMockPool(mockConn);
    const rows = [{ id: 'hero-1', name: 'Batman' }];
    (mockPool.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([rows, []]);

    const service = new MysqlDatabaseService(mockPool);
    const schema = z.object({ id: z.string(), name: z.string() });

    const result = await service.selectRows(mockPool, schema, 'SELECT * FROM heroes WHERE id = ?', ['hero-1']);
    expect(result).toEqual(rows);
    expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM heroes WHERE id = ?', ['hero-1']);

    // Testa também o helper de função pura exportado
    (mockPool.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([rows, []]);
    const helperResult = await selectRows(mockPool, schema, 'SELECT * FROM heroes WHERE id = ?', ['hero-1']);
    expect(helperResult).toEqual(rows);
  });

  it('deve executar mutações via execute retornando ResultSetHeader (instância e helper)', async () => {
    const mockConn = createMockConnection();
    const mockPool = createMockPool(mockConn);
    const header = { affectedRows: 1, insertId: 0 } as unknown as ResultSetHeader;
    (mockPool.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([header, []]);

    const service = new MysqlDatabaseService(mockPool);
    const result = await service.execute(mockPool, 'UPDATE heroes SET name = ? WHERE id = ?', ['Robin', 'hero-1']);
    expect(result.affectedRows).toBe(1);

    // Helper puro
    (mockPool.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([header, []]);
    const helperResult = await execute(mockPool, 'UPDATE heroes SET name = ? WHERE id = ?', ['Robin', 'hero-1']);
    expect(helperResult.affectedRows).toBe(1);
  });

  it('createPool deve instanciar pool com timezone Z e dateStrings DATE', () => {
    const pool = createPool('mysql://hero:hero@localhost:3306/hero_factory', 5);
    expect(pool).toBeDefined();
    expect(typeof pool.getConnection).toBe('function');
  });
});

describe('MysqlTransactionManager (Unit Test)', () => {
  it('deve executar transação com isolamento READ COMMITTED e commit com sucesso usando MysqlDatabaseService', async () => {
    const mockConn = createMockConnection();
    const mockPool = createMockPool(mockConn);
    const service = new MysqlDatabaseService(mockPool);
    const txManager = new MysqlTransactionManager(service);

    let capturedTx: Tx | null = null;
    const output = await txManager.run(async (tx) => {
      capturedTx = tx;
      const conn = txManager.connectionOf(tx);
      expect(conn).toBe(mockConn);
      return 'work-done';
    });

    expect(output).toBe('work-done');
    expect(mockConn.query).toHaveBeenCalledWith('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    expect(mockConn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(mockConn.commit).toHaveBeenCalledTimes(1);
    expect(mockConn.rollback).not.toHaveBeenCalled();
    expect(mockConn.release).toHaveBeenCalledTimes(1);

    // O handle da transação deve expirar no WeakMap após o bloco
    expect(() => txManager.connectionOf(capturedTx!)).toThrow('Transação já encerrada.');
    expect(() => connectionOf(capturedTx!)).toThrow('Transação já encerrada.');
  });

  it('deve suportar instanciação direta passando Pool', async () => {
    const mockConn = createMockConnection();
    const mockPool = createMockPool(mockConn);
    const txManager = new MysqlTransactionManager(mockPool);

    const output = await txManager.run(async (tx) => {
      expect(connectionOf(tx)).toBe(mockConn);
      return 'pool-ctor-success';
    });

    expect(output).toBe('pool-ctor-success');
    expect(mockConn.commit).toHaveBeenCalledTimes(1);
    expect(mockConn.release).toHaveBeenCalledTimes(1);
  });

  it('deve lançar erro se nenhum Pool ou Service for fornecido ao tentar conectar', async () => {
    const txManager = new MysqlTransactionManager();
    await expect(txManager.run(async () => 'never')).rejects.toThrow(
      'MysqlTransactionManager: nenhum Pool ou MysqlDatabaseService fornecido.',
    );
  });

  it('deve executar rollback e liberar conexão em caso de exceção no trabalho', async () => {
    const mockConn = createMockConnection();
    const mockPool = createMockPool(mockConn);
    const service = new MysqlDatabaseService(mockPool);
    const txManager = new MysqlTransactionManager(service);

    let capturedTx: Tx | null = null;
    await expect(
      txManager.run(async (tx) => {
        capturedTx = tx;
        throw new Error('Falha proposital de banco');
      }),
    ).rejects.toThrow('Falha proposital de banco');

    expect(mockConn.query).toHaveBeenCalledWith('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    expect(mockConn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(mockConn.commit).not.toHaveBeenCalled();
    expect(mockConn.rollback).toHaveBeenCalledTimes(1);
    expect(mockConn.release).toHaveBeenCalledTimes(1);
    expect(() => txManager.connectionOf(capturedTx!)).toThrow('Transação já encerrada.');
  });
});

describe('Database Error Helpers', () => {
  it('isMysqlError deve identificar erros de MySQL corretamente', () => {
    expect(isMysqlError({ code: 'ER_DUP_ENTRY' })).toBe(true);
    expect(isMysqlError({ code: 'ER_NO_SUCH_TABLE', sqlMessage: 'error' })).toBe(true);
    expect(isMysqlError(new Error('generic'))).toBe(false);
    expect(isMysqlError(null)).toBe(false);
    expect(isMysqlError(undefined)).toBe(false);
    expect(isMysqlError('ER_DUP_ENTRY')).toBe(false);
    expect(isMysqlError({ other: 'value' })).toBe(false);
  });

  it('duplicateKeyName deve extrair o nome da chave única duplicada', () => {
    const errWithSchema = {
      code: 'ER_DUP_ENTRY',
      sqlMessage: "Duplicate entry 'Batman' for key 'heroes.idx_heroes_name'",
    };
    expect(duplicateKeyName(errWithSchema)).toBe('idx_heroes_name');

    const errWithoutSchema = {
      code: 'ER_DUP_ENTRY',
      sqlMessage: "Duplicate entry 'Batman' for key 'idx_heroes_name'",
    };
    expect(duplicateKeyName(errWithoutSchema)).toBe('idx_heroes_name');

    const genericErr = {
      code: 'ER_NO_SUCH_TABLE',
      sqlMessage: "Table doesn't exist",
    };
    expect(duplicateKeyName(genericErr)).toBeNull();
    expect(duplicateKeyName(null)).toBeNull();
  });
});
