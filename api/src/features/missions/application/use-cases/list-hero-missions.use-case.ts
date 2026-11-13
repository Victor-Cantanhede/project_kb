import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../core/errors/domain.exception.js';
import {
  decodeCursor,
  toPage,
  type Page,
} from '../../../../core/pagination/keyset-pagination.js';
import { HeroFacadeService } from '../../../heroes/index.js';
import type { MissionEntity } from '../../domain/entities/mission.entity.js';
import {
  MISSION_REPOSITORY_TOKEN,
  type IMissionRepository,
} from '../../domain/ports/mission-repository.port.js';
import type { ListMissionsQueryDto } from '../../infrastructure/dtos/list-missions-query.dto.js';

@Injectable()
export class ListHeroMissionsUseCase {
  constructor(
    @Inject(MISSION_REPOSITORY_TOKEN)
    private readonly missionRepo: IMissionRepository,
    @Inject(HeroFacadeService)
    private readonly heroFacade: HeroFacadeService,
  ) {}

  async execute(
    rawHeroId: string,
    query: ListMissionsQueryDto,
  ): Promise<Page<MissionEntity>> {
    const hero = await this.heroFacade.getById(rawHeroId);
    if (!hero) {
      throw new DomainError(
        'not_found',
        'HERO_NOT_FOUND',
        'Herói não encontrado.',
      );
    }

    const after = query.cursor ? decodeCursor(query.cursor) : null;
    const records = await this.missionRepo.list({
      status: query.status ?? null,
      heroId: hero.id,
      after,
      limit: query.limit + 1,
    });
    return toPage(records, query.limit, (mission) => ({
      at: mission.starts_at,
      id: mission.id,
    }));
  }
}

