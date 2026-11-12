import type { Pool } from 'mysql2/promise';
import type { TransactionManager } from '../../shared/kernel/types.js';
import { MissionService } from './application/mission-service.js';
import type { HeroDirectoryPort } from './application/ports.js';
import { MysqlMissionRepository } from './infrastructure/mysql-mission-repository.js';

export {
  assertCanCancel,
  assertCanFinish,
  assertCanModifyRoster,
  assertCanStart,
  doPeriodsOverlap,
  MISSION_OUTCOMES,
  MISSION_STATUSES,
  MISSION_TITLE_MAX,
  missionCreateSchema,
  toMissionId,
  type Mission,
  type MissionCreateInput,
  type MissionHeroSummary,
  type MissionId,
  type MissionOutcome,
  type MissionStatus,
} from './domain/mission.js';
export { MissionService } from './application/mission-service.js';
export type { HeroDirectoryPort, MissionListQuery, MissionRecord, MissionRepository } from './application/ports.js';
export { registerMissionRoutes } from './infrastructure/http.js';

export function createMissionsModule(
  pool: Pool,
  txManager: TransactionManager,
  heroes: HeroDirectoryPort,
): MissionService {
  const repo = new MysqlMissionRepository(pool);
  return new MissionService(repo, heroes, txManager);
}

