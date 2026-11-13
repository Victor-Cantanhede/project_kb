import { Inject, Injectable } from '@nestjs/common';
import {
  decodeCursor,
  toPage,
  type Page,
} from '../../../../core/pagination/keyset-pagination.js';
import type { HeroEntity } from '../../domain/entities/hero.entity.js';
import {
  HERO_REPOSITORY_TOKEN,
  type IHeroRepository,
} from '../../domain/ports/hero-repository.port.js';
import type { ListHeroesQueryDto } from '../../infrastructure/dtos/list-heroes-query.dto.js';

@Injectable()
export class ListHeroesUseCase {
  constructor(
    @Inject(HERO_REPOSITORY_TOKEN)
    private readonly heroRepository: IHeroRepository,
  ) {}

  async execute(query: ListHeroesQueryDto): Promise<Page<HeroEntity>> {
    const after = query.cursor ? decodeCursor(query.cursor) : null;
    const limit = query.limit ?? 10;
    const rows = await this.heroRepository.list({
      search: query.search ?? null,
      after,
      limit: limit + 1,
    });

    return toPage(rows, limit, (hero) => ({
      at: hero.created_at,
      id: hero.id,
    }));
  }
}
