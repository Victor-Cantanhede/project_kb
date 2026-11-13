import { type DynamicModule, Global, Module, type Provider } from '@nestjs/common';
import type { Pool } from 'mysql2/promise';
import { MYSQL_POOL_TOKEN } from './database.tokens.js';
import { MysqlDatabaseService } from './mysql-database.service.js';
import { MysqlTransactionManager } from './mysql-transaction.manager.js';

export { MYSQL_POOL_TOKEN } from './database.tokens.js';

@Global()
@Module({})
export class DatabaseModule {
  static forRoot(pool?: Pool): DynamicModule {
    const providers: Provider[] = [
      pool
        ? {
            provide: MYSQL_POOL_TOKEN,
            useValue: pool,
          }
        : {
            provide: MYSQL_POOL_TOKEN,
            useValue: null,
          },
      {
        provide: MysqlDatabaseService,
        useFactory: (injectedPool?: Pool | null) => new MysqlDatabaseService(injectedPool),
        inject: [{ token: MYSQL_POOL_TOKEN, optional: true }],
      },
      {
        provide: MysqlTransactionManager,
        useFactory: (db: MysqlDatabaseService) => new MysqlTransactionManager(db),
        inject: [MysqlDatabaseService],
      },
    ];

    return {
      module: DatabaseModule,
      global: true,
      providers,
      exports: [MysqlDatabaseService, MysqlTransactionManager],
    };
  }
}
