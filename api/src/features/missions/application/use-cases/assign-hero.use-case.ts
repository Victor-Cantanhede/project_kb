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
export class AssignHeroUseCase {
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
      // Lock hero first so concurrent assignments for the same hero serialize across API instances.
      await this.heroFacade.lockActiveHeroForMission(tx, heroId);

      const mission = await this.missionRepo.lockById(tx, rawMissionId);
      if (!mission) {
        throw new DomainError(
          'not_found',
          'MISSION_NOT_FOUND',
          'Missão não encontrada.',
        );
      }

      assertCanModifyRoster(mission.status);
      if (mission.heroes.some((h) => h.id === heroId)) {
        throw new DomainError(
          'conflict',
          'HERO_ALREADY_ASSIGNED',
          'Este herói já está escalado nesta missão.',
        );
      }

      const conflict = await this.missionRepo.findOverlappingActiveMission(
        tx,
        heroId,
        mission.starts_at,
        mission.ends_at,
      );
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

      const outcome = await this.missionRepo.addHero(tx, rawMissionId, heroId);
      if (outcome === 'already_assigned') {
        throw new DomainError(
          'conflict',
          'HERO_ALREADY_ASSIGNED',
          'Este herói já está escalado nesta missão.',
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

