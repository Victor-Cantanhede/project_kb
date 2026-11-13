import type { Tx } from '../../../../core/database/mysql-transaction.manager.js';
import type { CursorPosition } from '../../../../core/pagination/keyset-pagination.js';
import type { HeroEntity } from '../entities/hero.entity.js';
import type { HeroHistoryEntity } from '../entities/hero-history.entity.js';
import type { HeroChange } from '../utils/hero-diff.util.js';

export const HERO_REPOSITORY_TOKEN = Symbol('IHeroRepository');

export type InsertOutcome =
  | { readonly kind: 'created'; readonly id: string }
  | { readonly kind: 'duplicate_idempotency_key' }
  | { readonly kind: 'duplicate_hero' };

export interface IdempotentCreation {
  /** null when the hero created with this key was deleted afterwards. */
  readonly hero: HeroEntity | null;
  readonly requestHash: string;
}

export interface HeroCreateInput {
  readonly name: string;
  readonly nickname: string;
  readonly date_of_birth: string;
  readonly universe: string;
  readonly main_power: string;
  readonly avatar_url?: string | null;
}

export interface HeroBatchInsertInput {
  readonly id?: string;
  readonly name: string;
  readonly nickname: string;
  readonly date_of_birth: string;
  readonly universe: string;
  readonly main_power: string;
  readonly avatar_url?: string | null;
}

export type HeroUpdateInput = Partial<{
  name: string;
  nickname: string;
  date_of_birth: string;
  universe: string;
  main_power: string;
  avatar_url: string | null;
  is_active: boolean;
}>;

export interface HeroListQuery {
  readonly search?: string | null;
  readonly after?: CursorPosition | null;
  readonly limit: number;
}

export interface HistoryQuery {
  readonly field?: string | null;
  readonly after?: CursorPosition | null;
  readonly limit: number;
}

export interface IHeroRepository {
  findById(id: string): Promise<HeroEntity | null>;
  findByIdIncludingDeleted(id: string): Promise<HeroEntity | null>;
  lockById(tx: Tx, id: string): Promise<HeroEntity | null>;
  findByIdempotencyKey(key: string): Promise<IdempotentCreation | null>;
  insert(
    input: HeroCreateInput,
    idempotency?: { readonly key: string | null; readonly hash: string | null },
  ): Promise<InsertOutcome>;
  insertMany(inputs: readonly HeroBatchInsertInput[]): Promise<number>;
  update(
    tx: Tx,
    id: string,
    updates: HeroUpdateInput,
    changes?: readonly HeroChange[],
  ): Promise<'updated' | 'duplicate_hero'>;
  softDelete(tx: Tx, id: string): Promise<void>;
  list(query: HeroListQuery): Promise<HeroEntity[]>;
  listHistory(heroId: string, query: HistoryQuery): Promise<HeroHistoryEntity[]>;
  findNicknames(ids: readonly string[]): Promise<Map<string, string>>;
}
