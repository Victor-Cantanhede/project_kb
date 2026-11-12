import { z } from 'zod';
import { DomainError } from '../../../shared/kernel/errors.js';
import { decodeCursor, toPage, type Page } from '../../../shared/kernel/pagination.js';
import type { TransactionManager, Tx } from '../../../shared/kernel/types.js';
import { parseInput } from '../../../shared/kernel/validation.js';
import type { HeroId } from '../../heroes/index.js';
import {
  assertCanCancel,
  assertCanFinish,
  assertCanModifyRoster,
  assertCanStart,
  MISSION_OUTCOMES,
  MISSION_STATUSES,
  missionCreateSchema,
  toMissionId,
  type Mission,
  type MissionId,
} from '../domain/mission.js';
import type { HeroDirectoryPort, MissionRecord, MissionRepository } from './ports.js';

const missionIdSchema = z.uuid({ error: 'Identificador de missão inválido.' }).transform(toMissionId);

const listQuerySchema = z.object({
  status: z.enum(MISSION_STATUSES).optional().transform((val) => val ?? null),
  hero_id: z.uuid({ error: 'Identificador de herói inválido.' }).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const assignHeroBodySchema = z.object({
  hero_id: z.uuid({ error: 'Informe um identificador de herói válido.' }),
});

const finishBodySchema = z.object({
  result: z.enum(MISSION_OUTCOMES, { error: 'Informe o resultado da missão: succeeded ou failed.' }),
});

export class MissionService {
  constructor(
    private readonly repo: MissionRepository,
    private readonly heroes: HeroDirectoryPort,
    private readonly txManager: TransactionManager,
  ) {}

  parseMissionId(rawId: unknown): MissionId {
    return parseInput(z.object({ id: missionIdSchema }), { id: rawId }).id;
  }

  async create(rawBody: unknown): Promise<Mission> {
    const input = parseInput(missionCreateSchema, rawBody);
    const record = await this.repo.insert(input);
    return this.hydrateOne(record);
  }

  async getById(rawId: unknown): Promise<Mission> {
    const id = this.parseMissionId(rawId);
    const record = await this.repo.findById(id);
    if (!record) throw new DomainError('not_found', 'MISSION_NOT_FOUND', 'Missão não encontrada.');
    return this.hydrateOne(record);
  }

  async list(rawQuery: unknown): Promise<Page<Mission>> {
    const query = parseInput(listQuerySchema, rawQuery);
    const heroId = query.hero_id ? this.heroes.parseHeroId(query.hero_id) : null;
    return this.fetchPage({ status: query.status, heroId, cursor: query.cursor, limit: query.limit });
  }

  async listForHero(rawHeroId: unknown, rawQuery: unknown): Promise<Page<Mission>> {
    const hero = await this.heroes.getById(rawHeroId);
    const query = parseInput(listQuerySchema, rawQuery);
    return this.fetchPage({ status: query.status, heroId: hero.id, cursor: query.cursor, limit: query.limit });
  }

  private async fetchPage(params: {
    readonly status: (typeof MISSION_STATUSES)[number] | null;
    readonly heroId: HeroId | null;
    readonly cursor: string | undefined;
    readonly limit: number;
  }): Promise<Page<Mission>> {
    const after = params.cursor ? decodeCursor(params.cursor) : null;
    const records = await this.repo.list({
      status: params.status,
      heroId: params.heroId,
      after,
      limit: params.limit + 1,
    });
    const missions = await this.hydrateMany(records);
    return toPage(missions, params.limit, (mission) => ({ at: mission.starts_at, id: mission.id }));
  }

  async assignHero(rawMissionId: unknown, rawBody: unknown): Promise<Mission> {
    const missionId = this.parseMissionId(rawMissionId);
    const { hero_id: rawHeroId } = parseInput(assignHeroBodySchema, rawBody);
    const heroId = this.heroes.parseHeroId(rawHeroId);

    const updated = await this.txManager.run(async (tx) => {
      // Lock the hero row first so concurrent assignments for the same hero serialize across API instances.
      await this.heroes.lockActiveHeroForMission(tx, heroId);
      const mission = await this.lockExistingMission(tx, missionId);
      assertCanModifyRoster(mission.status);
      if (mission.heroIds.includes(heroId)) {
        throw new DomainError('conflict', 'HERO_ALREADY_ASSIGNED', 'Este herói já está escalado nesta missão.');
      }
      const conflict = await this.repo.findOverlappingActiveMission(tx, heroId, mission.starts_at, mission.ends_at);
      if (conflict) {
        throw new DomainError(
          'conflict',
          'MISSION_SCHEDULE_CONFLICT',
          `Choque de horário: o herói já está escalado na missão "${conflict.title}".`,
          {
            details: {
              conflicting_mission: {
                id: conflict.id,
                title: conflict.title,
                starts_at: conflict.starts_at,
                ends_at: conflict.ends_at,
              },
            },
          },
        );
      }
      const result = await this.repo.addHero(tx, missionId, heroId);
      if (result === 'already_assigned') {
        throw new DomainError('conflict', 'HERO_ALREADY_ASSIGNED', 'Este herói já está escalado nesta missão.');
      }
      return this.lockExistingMission(tx, missionId);
    });
    return this.hydrateOne(updated);
  }

  async removeHero(rawMissionId: unknown, rawHeroId: unknown): Promise<Mission> {
    const missionId = this.parseMissionId(rawMissionId);
    const heroId = this.heroes.parseHeroId(rawHeroId);
    const updated = await this.txManager.run(async (tx) => {
      const mission = await this.lockExistingMission(tx, missionId);
      assertCanModifyRoster(mission.status);
      const removed = await this.repo.removeHero(tx, missionId, heroId);
      if (!removed) {
        throw new DomainError('not_found', 'HERO_NOT_IN_MISSION', 'Este herói não está escalado nesta missão.');
      }
      return this.lockExistingMission(tx, missionId);
    });
    return this.hydrateOne(updated);
  }

  async start(rawMissionId: unknown): Promise<Mission> {
    const missionId = this.parseMissionId(rawMissionId);
    const updated = await this.txManager.run(async (tx) => {
      const mission = await this.lockExistingMission(tx, missionId);
      assertCanStart(mission.status, mission.heroIds.length);
      await this.repo.updateStatus(tx, missionId, 'in_progress');
      return this.lockExistingMission(tx, missionId);
    });
    return this.hydrateOne(updated);
  }

  async finish(rawMissionId: unknown, rawBody: unknown): Promise<Mission> {
    const missionId = this.parseMissionId(rawMissionId);
    const { result } = parseInput(finishBodySchema, rawBody);
    const updated = await this.txManager.run(async (tx) => {
      const mission = await this.lockExistingMission(tx, missionId);
      assertCanFinish(mission.status);
      await this.repo.updateStatus(tx, missionId, result);
      return this.lockExistingMission(tx, missionId);
    });
    return this.hydrateOne(updated);
  }

  async cancel(rawMissionId: unknown): Promise<Mission> {
    const missionId = this.parseMissionId(rawMissionId);
    const updated = await this.txManager.run(async (tx) => {
      const mission = await this.lockExistingMission(tx, missionId);
      assertCanCancel(mission.status);
      await this.repo.updateStatus(tx, missionId, 'cancelled');
      return this.lockExistingMission(tx, missionId);
    });
    return this.hydrateOne(updated);
  }

  private async lockExistingMission(tx: Tx, id: MissionId): Promise<MissionRecord> {
    const mission = await this.repo.lockById(tx, id);
    if (!mission) throw new DomainError('not_found', 'MISSION_NOT_FOUND', 'Missão não encontrada.');
    return mission;
  }

  private async hydrateOne(record: MissionRecord): Promise<Mission> {
    const [mission] = await this.hydrateMany([record]);
    if (!mission) throw new DomainError('not_found', 'MISSION_NOT_FOUND', 'Missão não encontrada.');
    return mission;
  }

  private async hydrateMany(records: readonly MissionRecord[]): Promise<readonly Mission[]> {
    const uniqueHeroIds: HeroId[] = Array.from(new Set(records.flatMap((record) => record.heroIds)));
    const nicknames = await this.heroes.findNicknames(uniqueHeroIds);
    return records.map((record) => ({
      id: record.id,
      title: record.title,
      starts_at: record.starts_at,
      ends_at: record.ends_at,
      status: record.status,
      heroes: record.heroIds.map((heroId) => ({
        id: heroId,
        nickname: nicknames.get(heroId) ?? 'Herói desconhecido',
      })),
    }));
  }
}

