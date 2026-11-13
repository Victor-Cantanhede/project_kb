import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../core/errors/domain.exception.js';
import {
  decodeCursor,
  toPage,
  type Page,
} from '../../../../core/pagination/keyset-pagination.js';
import type { HeroHistoryEntity } from '../../domain/entities/hero-history.entity.js';
import {
  HERO_REPOSITORY_TOKEN,
  type IHeroRepository,
} from '../../domain/ports/hero-repository.port.js';
import type { ListHeroHistoryQueryDto } from '../../infrastructure/dtos/list-hero-history-query.dto.js';
import { validateHeroId } from './update-hero.use-case.js';

@Injectable()
export class ListHeroHistoryUseCase {
  constructor(
    @Inject(HERO_REPOSITORY_TOKEN)
    private readonly heroRepository: IHeroRepository,
  ) {}

  async execute(
    id: string,
    query: ListHeroHistoryQueryDto,
  ): Promise<Page<HeroHistoryEntity>> {
    validateHeroId(id);

    const hero = await this.heroRepository.findById(id);
    if (!hero) {
      throw new DomainError('not_found', 'HERO_NOT_FOUND', 'Herói não encontrado.');
    }

    const after = query.cursor ? decodeCursor(query.cursor) : null;
    const limit = query.limit ?? 10;
    const rows = await this.heroRepository.listHistory(id, {
      field: query.field ?? null,
      after,
      limit: limit + 1,
    });

    return toPage(rows, limit, (entry) => ({
      at: entry.changed_at,
      id: entry.id,
    }));
  }
}
