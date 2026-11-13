import { Inject, Injectable } from '@nestjs/common';
import { MysqlTransactionManager } from '../../../../core/database/mysql-transaction.manager.js';
import { DomainError } from '../../../../core/errors/domain.exception.js';
import type { MissionEntity } from '../../domain/entities/mission.entity.js';
import {
  MISSION_REPOSITORY_TOKEN,
  type IMissionRepository,
} from '../../domain/ports/mission-repository.port.js';
import { assertCanStart } from '../../domain/utils/mission-schedule.util.js';
import { validateMissionId } from './get-mission.use-case.js';

@Injectable()
export class StartMissionUseCase {
  constructor(
    @Inject(MISSION_REPOSITORY_TOKEN)
    private readonly missionRepo: IMissionRepository,
    @Inject(MysqlTransactionManager)
    private readonly txManager: MysqlTransactionManager,
  ) {}

  async execute(rawMissionId: string): Promise<MissionEntity> {
    validateMissionId(rawMissionId);

    return this.txManager.run(async (tx) => {
      const mission = await this.missionRepo.lockById(tx, rawMissionId);
      if (!mission) {
        throw new DomainError(
          'not_found',
          'MISSION_NOT_FOUND',
          'Missão não encontrada.',
        );
      }

      assertCanStart(mission.status, mission.heroes.length);
      await this.missionRepo.updateStatus(tx, rawMissionId, 'in_progress');

      const updated = await this.missionRepo.lockById(tx, rawMissionId);
      if (!updated) {
        throw new DomainError(
          'not_found',
          'MISSION_NOT_FOUND',
          'Missão não encontrada.',
        );
      }
      return updated;
    });
  }
}

