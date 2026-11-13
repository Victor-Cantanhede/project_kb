import {
  type DynamicModule,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import type { Pool } from 'mysql2/promise';
import { DatabaseModule } from './core/database/database.module.js';
import { RequestLoggerMiddleware } from './core/observability/request-logger.middleware.js';
import { AvatarsModule } from './features/avatars/index.js';
import { HealthModule } from './features/health/index.js';
import { HeroesModule } from './features/heroes/index.js';
import { ImportsModule } from './features/imports/index.js';
import { MissionsModule } from './features/missions/index.js';

@Module({})
export class AppModule implements NestModule {
  static register(pool?: Pool): DynamicModule {
    return {
      module: AppModule,
      imports: [
        DatabaseModule.forRoot(pool),
        HealthModule,
        AvatarsModule,
        HeroesModule,
        MissionsModule,
        ImportsModule,
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}

