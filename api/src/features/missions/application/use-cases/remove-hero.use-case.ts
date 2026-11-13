import { Inject, Injectable } from '@nestjs/common';
import { MysqlTransactionManager } from '../../../../core/database/mysql-transaction.manager.js';
import { DomainError } from '../../../../core/errors/domain.exception.js';
import { HeroFacadeService } from '../../../heroes/index.js';
import type { MissionEntity } from '../../domain/entities/mission.entity.js';
import {
  MISSION_REPOSITORY_TOKEN,
  type IMissionRepository,
} from '../../domain/ports/mission-repository.port.js';
import { assertCanModifyRoster } from '../../domain/utils/mission-schedule.util.js';
import { validateMissionId } from './get-mission.use-case.js';

@Injectable()
export class RemoveHeroUseCase {
  constructor(
    @Inject(MISSION_REPOSITORY_TOKEN)
    private readonly missionRepo: IMissionRepository,
    @Inject(HeroFacadeService)
    private readonly heroFacade: HeroFacadeService,
    @Inject(MysqlTransactionManager)
    private readonly txManager: MysqlTransactionManager,
  ) {}

  async execute(rawMissionId: string, rawHeroId: string): Promise<MissionEntity> {
    validateMissionId(rawMissionId);
    const heroId = this.heroFacade.parseHeroId(rawHeroId);

    return this.txManager.run(async (tx) => {
      const mission = await this.missionRepo.lockById(tx, rawMissionId);
      if (!mission) {
        throw new DomainError(
          'not_found',
          'MISSION_NOT_FOUND',
          'Missão não encontrada.',
        );
      }

      assertCanModifyRoster(mission.status);
      const removed = await this.missionRepo.removeHero(
        tx,
        rawMissionId,
        heroId,
      );
      if (!removed) {
        throw new DomainError(
          'not_found',
          'HERO_NOT_IN_MISSION',
          'Este herói não está escalado nesta missão.',
        );
      }

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

