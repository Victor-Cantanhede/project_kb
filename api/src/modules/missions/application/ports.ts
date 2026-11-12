import type { CursorPosition } from '../../../shared/kernel/pagination.js';
import type { Tx } from '../../../shared/kernel/types.js';
import type { HeroId } from '../../heroes/index.js';
import type { MissionCreateInput, MissionId, MissionStatus } from '../domain/mission.js';

export interface MissionRecord {
  readonly id: MissionId;
  readonly title: string;
  readonly starts_at: Date;
  readonly ends_at: Date;
  readonly status: MissionStatus;
  readonly heroIds: readonly HeroId[];
}

export interface MissionListQuery {
  readonly status: MissionStatus | null;
  readonly heroId: HeroId | null;
  readonly after: CursorPosition | null;
  readonly limit: number;
}

export interface MissionRepository {
  insert(input: MissionCreateInput): Promise<MissionRecord>;
  findById(id: MissionId): Promise<MissionRecord | null>;
  lockById(tx: Tx, id: MissionId): Promise<MissionRecord | null>;
  list(query: MissionListQuery): Promise<readonly MissionRecord[]>;
  findOverlappingActiveMission(
    tx: Tx,
    heroId: HeroId,
    startsAt: Date,
    endsAt: Date,
  ): Promise<MissionRecord | null>;
  addHero(tx: Tx, missionId: MissionId, heroId: HeroId): Promise<'added' | 'already_assigned'>;
  removeHero(tx: Tx, missionId: MissionId, heroId: HeroId): Promise<boolean>;
  updateStatus(tx: Tx, missionId: MissionId, status: MissionStatus): Promise<void>;
}

export interface HeroDirectoryPort {
  parseHeroId(rawId: unknown): HeroId;
  getById(rawId: unknown): Promise<{ readonly id: HeroId }>;
  lockActiveHeroForMission(tx: Tx, id: HeroId): Promise<{ readonly id: HeroId; readonly nickname: string }>;
  findNicknames(ids: readonly HeroId[]): Promise<ReadonlyMap<HeroId, string>>;
}

