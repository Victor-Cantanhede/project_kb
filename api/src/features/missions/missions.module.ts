import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module.js';
import { HeroesModule } from '../heroes/index.js';
import { MISSION_REPOSITORY_TOKEN } from './domain/ports/mission-repository.port.js';
import { MysqlMissionRepository } from './infrastructure/adapters/mysql-mission.repository.js';
import { AssignHeroUseCase } from './application/use-cases/assign-hero.use-case.js';
import { CancelMissionUseCase } from './application/use-cases/cancel-mission.use-case.js';
import { CreateMissionUseCase } from './application/use-cases/create-mission.use-case.js';
import { FinishMissionUseCase } from './application/use-cases/finish-mission.use-case.js';
import { GetMissionUseCase } from './application/use-cases/get-mission.use-case.js';
import { ListHeroMissionsUseCase } from './application/use-cases/list-hero-missions.use-case.js';
import { ListMissionsUseCase } from './application/use-cases/list-missions.use-case.js';
import { RemoveHeroUseCase } from './application/use-cases/remove-hero.use-case.js';
import { StartMissionUseCase } from './application/use-cases/start-mission.use-case.js';
import { MissionsController } from './presentation/missions.controller.js';

@Module({
  imports: [DatabaseModule, HeroesModule],
  controllers: [MissionsController],
  providers: [
    CreateMissionUseCase,
    GetMissionUseCase,
    ListMissionsUseCase,
    ListHeroMissionsUseCase,
    AssignHeroUseCase,
    RemoveHeroUseCase,
    StartMissionUseCase,
    FinishMissionUseCase,
    CancelMissionUseCase,
    {
      provide: MISSION_REPOSITORY_TOKEN,
      useClass: MysqlMissionRepository,
    },
  ],
  exports: [
    MISSION_REPOSITORY_TOKEN,
    CreateMissionUseCase,
    GetMissionUseCase,
    ListMissionsUseCase,
    ListHeroMissionsUseCase,
    AssignHeroUseCase,
    RemoveHeroUseCase,
    StartMissionUseCase,
    FinishMissionUseCase,
    CancelMissionUseCase,
  ],
})
export class MissionsModule {}

