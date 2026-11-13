import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../core/errors/domain.exception.js';
import type { HeroEntity } from '../../domain/entities/hero.entity.js';
import {
  HERO_REPOSITORY_TOKEN,
  type IHeroRepository,
} from '../../domain/ports/hero-repository.port.js';
import { validateHeroId } from './update-hero.use-case.js';

@Injectable()
export class GetHeroUseCase {
  constructor(
    @Inject(HERO_REPOSITORY_TOKEN)
    private readonly heroRepository: IHeroRepository,
  ) {}

  async execute(id: string): Promise<HeroEntity> {
    validateHeroId(id);
    const hero = await this.heroRepository.findById(id);
    if (!hero) {
      throw new DomainError('not_found', 'HERO_NOT_FOUND', 'Herói não encontrado.');
    }
    return hero;
  }
}
