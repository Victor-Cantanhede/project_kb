import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module.js';
import { HERO_REPOSITORY_TOKEN } from './domain/ports/hero-repository.port.js';
import { MysqlHeroRepository } from './infrastructure/adapters/mysql-hero.repository.js';
import { CreateHeroUseCase } from './application/use-cases/create-hero.use-case.js';
import { UpdateHeroUseCase } from './application/use-cases/update-hero.use-case.js';
import { ListHeroesUseCase } from './application/use-cases/list-heroes.use-case.js';
import { GetHeroUseCase } from './application/use-cases/get-hero.use-case.js';
import { ToggleHeroStatusUseCase } from './application/use-cases/toggle-hero-status.use-case.js';
import { DeleteHeroUseCase } from './application/use-cases/delete-hero.use-case.js';
import { ListHeroHistoryUseCase } from './application/use-cases/list-hero-history.use-case.js';
import { HeroFacadeService } from './application/services/hero-facade.service.js';
import { HeroesController } from './presentation/heroes.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [HeroesController],
  providers: [
    CreateHeroUseCase,
    UpdateHeroUseCase,
    ListHeroesUseCase,
    GetHeroUseCase,
    ToggleHeroStatusUseCase,
    DeleteHeroUseCase,
    ListHeroHistoryUseCase,
    HeroFacadeService,
    {
      provide: HERO_REPOSITORY_TOKEN,
      useClass: MysqlHeroRepository,
    },
  ],
  exports: [
    HeroFacadeService,
    HERO_REPOSITORY_TOKEN,
    CreateHeroUseCase,
    UpdateHeroUseCase,
    ListHeroesUseCase,
    GetHeroUseCase,
    ToggleHeroStatusUseCase,
    DeleteHeroUseCase,
    ListHeroHistoryUseCase,
  ],
})
export class HeroesModule {}
