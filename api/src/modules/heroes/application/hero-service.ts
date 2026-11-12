import { createHash } from 'node:crypto';
import { z } from 'zod';
import { DomainError, validationError } from '../../../shared/kernel/errors.js';
import { decodeCursor, toPage, type Page } from '../../../shared/kernel/pagination.js';
import type { TransactionManager, Tx } from '../../../shared/kernel/types.js';
import { parseInput } from '../../../shared/kernel/validation.js';
import {
  activationChange,
  buildHeroCreateSchema,
  buildHeroPatchSchema,
  diffHero,
  HISTORY_FIELDS,
  todayIn,
  toHeroId,
  type Hero,
  type HeroCreateInput,
  type HeroId,
  type HistoryField,
} from '../domain/hero.js';
import type { HeroHistoryEntry, HeroRepository, HeroUpdate } from './ports.js';

const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

const heroIdSchema = z.uuid({ error: 'Identificador de herói inválido.' }).transform(toHeroId);

const listQuerySchema = z.object({
  search: z.string().trim().max(120).optional().transform((val) => (val && val.length > 0 ? val : null)),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const historyQuerySchema = z.object({
  field: z.enum(HISTORY_FIELDS).optional().transform((val) => val ?? null),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const idempotencyKeySchema = z
  .string()
  .trim()
  .min(1, { error: 'Chave de idempotência vazia.' })
  .max(100, { error: 'Chave de idempotência deve ter no máximo 100 caracteres.' })
  .regex(/^[\x21-\x7E]+$/, { error: 'Chave de idempotência deve conter apenas caracteres ASCII visíveis.' });

function hashCreatePayload(input: HeroCreateInput): string {
  const canonical = JSON.stringify([
    input.name.toLowerCase(),
    input.nickname.toLowerCase(),
    input.date_of_birth,
    input.universe.toLowerCase(),
    input.main_power.toLowerCase(),
    input.avatar_url ?? '',
  ]);
  return createHash('sha256').update(canonical).digest('hex');
}

export interface CreateHeroOptions {
  readonly idempotencyKey?: string | undefined;
  readonly timeZone?: string | undefined;
}

export interface CreateHeroResult {
  readonly hero: Hero;
  readonly created: boolean;
}

export class HeroService {
  constructor(
    private readonly repo: HeroRepository,
    private readonly txManager: TransactionManager,
  ) {}

  parseHeroId(rawId: unknown): HeroId {
    return parseInput(z.object({ id: heroIdSchema }), { id: rawId }).id;
  }

  async list(rawQuery: unknown): Promise<Page<Hero>> {
    const query = parseInput(listQuerySchema, rawQuery);
    const after = query.cursor ? decodeCursor(query.cursor) : null;
    const rows = await this.repo.list({ search: query.search, after, limit: query.limit + 1 });
    return toPage(rows, query.limit, (hero) => ({ at: hero.created_at, id: hero.id }));
  }

  async getById(rawId: unknown): Promise<Hero> {
    const id = this.parseHeroId(rawId);
    const hero = await this.repo.findById(id);
    if (!hero) throw new DomainError('not_found', 'HERO_NOT_FOUND', 'Herói não encontrado.');
    return hero;
  }

  async create(rawBody: unknown, options: CreateHeroOptions = {}): Promise<CreateHeroResult> {
    const today = todayIn(options.timeZone ?? DEFAULT_TIME_ZONE, new Date(), DEFAULT_TIME_ZONE);
    const input = parseInput(buildHeroCreateSchema(today), rawBody);
    const key = options.idempotencyKey !== undefined
      ? parseInput(z.object({ idempotency_key: idempotencyKeySchema }), { idempotency_key: options.idempotencyKey }).idempotency_key
      : null;
    const hash = key ? hashCreatePayload(input) : null;
    const outcome = await this.repo.insert(input, { key, hash });
    if (outcome.kind === 'created') {
      const hero = await this.repo.findById(outcome.id);
      if (!hero) throw new DomainError('not_found', 'HERO_NOT_FOUND', 'Herói não encontrado.');
      return { hero, created: true };
    }
    if (outcome.kind === 'duplicate_idempotency_key' && key && hash) {
      return this.resolveIdempotentRetry(key, hash);
    }
    throw new DomainError('conflict', 'DUPLICATE_HERO', 'Já existe um herói com este nome, nome de guerra e data de nascimento.');
  }

  private async resolveIdempotentRetry(key: string, hash: string): Promise<CreateHeroResult> {
    const previous = await this.repo.findByIdempotencyKey(key);
    if (!previous || previous.requestHash !== hash) {
      throw new DomainError('conflict', 'IDEMPOTENCY_KEY_CONFLICT', 'Esta chave de idempotência já foi usada com outros dados.');
    }
    if (!previous.hero) {
      throw new DomainError('not_found', 'HERO_NOT_FOUND', 'O herói criado anteriormente com esta chave foi excluído.');
    }
    return { hero: previous.hero, created: false };
  }

  async update(rawId: unknown, rawBody: unknown, timeZone?: string): Promise<Hero> {
    const id = this.parseHeroId(rawId);
    const today = todayIn(timeZone ?? DEFAULT_TIME_ZONE, new Date(), DEFAULT_TIME_ZONE);
    const patch = parseInput(buildHeroPatchSchema(today), rawBody);
    return this.txManager.run(async (tx) => {
      const current = await this.lockExistingHero(tx, id);
      if (!current.is_active) {
        throw new DomainError('conflict', 'HERO_INACTIVE', 'Herói inativo não pode ser editado.');
      }
      if (patch.version !== current.version) {
        throw new DomainError(
          'conflict',
          'HERO_VERSION_CONFLICT',
          'Este herói foi alterado depois que você abriu a edição. Atualize os dados sem perder o que digitou.',
          { details: { current_hero: current } },
        );
      }
      const changes = diffHero(current, patch);
      if (changes.length === 0) return current;
      const values: HeroUpdate = {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.nickname !== undefined ? { nickname: patch.nickname } : {}),
        ...(patch.date_of_birth !== undefined ? { date_of_birth: patch.date_of_birth } : {}),
        ...(patch.universe !== undefined ? { universe: patch.universe } : {}),
        ...(patch.main_power !== undefined ? { main_power: patch.main_power } : {}),
        ...(patch.avatar_url !== undefined ? { avatar_url: patch.avatar_url } : {}),
      };
      const status = await this.repo.update(tx, id, values, changes);
      if (status === 'duplicate_hero') {
        throw new DomainError('conflict', 'DUPLICATE_HERO', 'Já existe um herói com este nome, nome de guerra e data de nascimento.');
      }
      return this.requireAfterUpdate(tx, id);
    });
  }

  async setActive(rawId: unknown, active: boolean): Promise<Hero> {
    const id = this.parseHeroId(rawId);
    return this.txManager.run(async (tx) => {
      const current = await this.lockExistingHero(tx, id);
      if (current.is_active === active) {
        const msg = active ? 'Este herói já está ativo.' : 'Este herói já está inativo.';
        throw new DomainError('conflict', active ? 'HERO_ALREADY_ACTIVE' : 'HERO_ALREADY_INACTIVE', msg);
      }
      await this.repo.update(tx, id, { is_active: active }, [activationChange(current, active)]);
      return this.requireAfterUpdate(tx, id);
    });
  }

  async remove(rawId: unknown): Promise<void> {
    const id = this.parseHeroId(rawId);
    await this.txManager.run(async (tx) => {
      await this.lockExistingHero(tx, id);
      await this.repo.softDelete(tx, id);
    });
  }

  async listHistory(rawId: unknown, rawQuery: unknown): Promise<Page<HeroHistoryEntry>> {
    const id = this.parseHeroId(rawId);
    await this.getById(id);
    const query = parseInput(historyQuerySchema, rawQuery);
    const after = query.cursor ? decodeCursor(query.cursor) : null;
    const rows = await this.repo.listHistory(id, {
      field: query.field,
      after,
      limit: query.limit + 1,
    });
    return toPage(rows, query.limit, (entry) => ({ at: entry.changed_at, id: entry.id }));
  }

  /** Cross-module facade helper: locks the hero in an active transaction and verifies it exists and is active. */
  async lockActiveHeroForMission(tx: Tx, id: HeroId): Promise<Hero> {
    const hero = await this.lockExistingHero(tx, id);
    if (!hero.is_active) {
      throw new DomainError('conflict', 'HERO_INACTIVE', 'Herói inativo não pode ser escalado em missão.');
    }
    return hero;
  }

  async findNicknames(ids: readonly HeroId[]): Promise<ReadonlyMap<HeroId, string>> {
    return this.repo.findNicknames(ids);
  }

  async insertBatch(inputs: readonly HeroCreateInput[]): Promise<number> {
    return this.repo.insertMany(inputs);
  }

  private async lockExistingHero(tx: Tx, id: HeroId): Promise<Hero> {
    const hero = await this.repo.lockById(tx, id);
    if (!hero) throw new DomainError('not_found', 'HERO_NOT_FOUND', 'Herói não encontrado.');
    return hero;
  }

  private async requireAfterUpdate(tx: Tx, id: HeroId): Promise<Hero> {
    const updated = await this.repo.lockById(tx, id);
    if (!updated) throw validationError([{ field: 'id', message: 'Herói não encontrado.' }]);
    return updated;
  }
}
