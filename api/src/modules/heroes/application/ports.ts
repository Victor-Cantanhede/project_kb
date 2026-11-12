import type { CursorPosition } from '../../../shared/kernel/pagination.js';
import type { Tx } from '../../../shared/kernel/types.js';
import type { Hero, HeroChange, HeroCreateInput, HeroId, HistoryField } from '../domain/hero.js';

export type InsertOutcome =
  | { readonly kind: 'created'; readonly id: HeroId }
  | { readonly kind: 'duplicate_idempotency_key' }
  | { readonly kind: 'duplicate_hero' };

export interface IdempotentCreation {
  /** null when the hero created with this key was deleted afterwards. */
  readonly hero: Hero | null;
  readonly requestHash: string;
}

export type HeroUpdate = Partial<Pick<Hero, HeroChange['field']>>;

export interface HeroHistoryEntry {
  readonly id: string;
  readonly field: HistoryField;
  readonly old_value: string | null;
  readonly new_value: string | null;
  readonly changed_at: Date;
}

export interface HeroListQuery {
  readonly search: string | null;
  readonly after: CursorPosition | null;
  readonly limit: number;
}

export interface HistoryQuery {
  readonly field: HistoryField | null;
  readonly after: CursorPosition | null;
  readonly limit: number;
}

/** Reads never return deleted heroes, except where stated. */
export interface HeroRepository {
  insert(
    input: HeroCreateInput,
    idempotency: { readonly key: string | null; readonly hash: string | null },
  ): Promise<InsertOutcome>;
  /** Inserts what is new and skips repeated heroes; returns how many were inserted. */
  insertMany(inputs: readonly HeroCreateInput[]): Promise<number>;
  findById(id: HeroId): Promise<Hero | null>;
  findByIdempotencyKey(key: string): Promise<IdempotentCreation | null>;
  list(query: HeroListQuery): Promise<readonly Hero[]>;
  /** Includes deleted heroes: past missions keep showing their names. */
  findNicknames(ids: readonly HeroId[]): Promise<ReadonlyMap<HeroId, string>>;
  /** SELECT ... FOR UPDATE: holds the hero row until the transaction ends. */
  lockById(tx: Tx, id: HeroId): Promise<Hero | null>;
  /** Writes the new values, bumps the version and records each change in the history. */
  update(tx: Tx, id: HeroId, values: HeroUpdate, changes: readonly HeroChange[]): Promise<'updated' | 'duplicate_hero'>;
  softDelete(tx: Tx, id: HeroId): Promise<void>;
  listHistory(heroId: HeroId, query: HistoryQuery): Promise<readonly HeroHistoryEntry[]>;
}

