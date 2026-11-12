import type { Pool } from 'mysql2/promise';
import type { TransactionManager } from '../../shared/kernel/types.js';
import { HeroService } from './application/hero-service.js';
import { MysqlHeroRepository } from './infrastructure/mysql-hero-repository.js';

export {
  buildHeroCreateSchema,
  buildHeroPatchSchema,
  diffHero,
  EDITABLE_FIELDS,
  HERO_LIMITS,
  HISTORY_FIELDS,
  isCalendarDay,
  MIN_DATE_OF_BIRTH,
  todayIn,
  toHeroId,
  type Hero,
  type HeroChange,
  type HeroCreateInput,
  type HeroId,
  type HeroPatchInput,
  type HistoryField,
} from './domain/hero.js';
export { HeroService, type CreateHeroOptions, type CreateHeroResult } from './application/hero-service.js';
export type { HeroHistoryEntry, HeroListQuery, HeroRepository, HistoryQuery, InsertOutcome } from './application/ports.js';
export { registerHeroRoutes } from './infrastructure/http.js';

export function createHeroesModule(pool: Pool, txManager: TransactionManager): HeroService {
  const repo = new MysqlHeroRepository(pool);
  return new HeroService(repo, txManager);
}

