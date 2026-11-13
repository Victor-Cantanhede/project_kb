import type { Tx } from '../../../../core/database/mysql-transaction.manager.js';
import type { CursorPosition } from '../../../../core/pagination/keyset-pagination.js';
import type {
  MissionEntity,
  MissionStatus,
} from '../entities/mission.entity.js';

export const MISSION_REPOSITORY_TOKEN = Symbol('IMissionRepository');

export interface MissionCreateInput {
  readonly title: string;
  readonly starts_at: Date;
  readonly ends_at: Date;
}

export interface MissionListQuery {
  readonly status?: MissionStatus | null;
  readonly heroId?: string | null;
  readonly after?: CursorPosition | null;
  readonly limit: number;
}

export interface IMissionRepository {
  insert(input: MissionCreateInput): Promise<MissionEntity>;
  findById(id: string): Promise<MissionEntity | null>;
  lockById(tx: Tx, id: string): Promise<MissionEntity | null>;
  list(query: MissionListQuery): Promise<MissionEntity[]>;
  findOverlappingActiveMission(
    tx: Tx,
    heroId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<MissionEntity | null>;
  addHero(
    tx: Tx,
    missionId: string,
    heroId: string,
  ): Promise<'added' | 'already_assigned'>;
  removeHero(tx: Tx, missionId: string, heroId: string): Promise<boolean>;
  updateStatus(tx: Tx, missionId: string, status: MissionStatus): Promise<void>;
}
