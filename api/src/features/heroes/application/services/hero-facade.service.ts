import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../core/errors/domain.exception.js';
import type { Tx } from '../../../../core/database/mysql-transaction.manager.js';
import type { HeroEntity } from '../../domain/entities/hero.entity.js';
import {
  HERO_REPOSITORY_TOKEN,
  type HeroBatchInsertInput,
  type IHeroRepository,
} from '../../domain/ports/hero-repository.port.js';
import { validateHeroId } from '../use-cases/update-hero.use-case.js';

@Injectable()
export class HeroFacadeService {
  constructor(
    @Inject(HERO_REPOSITORY_TOKEN)
    private readonly heroRepository: IHeroRepository,
  ) {}

  /**
   * Retrieves a hero by ID (returns null if not found or soft-deleted).
   */
  async getById(id: string): Promise<HeroEntity | null> {
    this.parseHeroId(id);
    return this.heroRepository.findById(id);
  }

  /**
   * Validates and returns a hero UUID, throwing 400 VALIDATION_ERROR on field 'id' if invalid.
   */
  parseHeroId(rawId: string): string {
    validateHeroId(rawId);
    return rawId;
  }

  /**
   * Cross-feature invariant helper for missions:
   * Locks the active hero with SELECT ... FOR UPDATE in the given transaction.
   * Throws 404 HERO_NOT_FOUND if deleted/missing, and 409 HERO_INACTIVE if inactive.
   */
  async lockActiveHeroForMission(tx: Tx, heroId: string): Promise<HeroEntity> {
    this.parseHeroId(heroId);
    const hero = await this.heroRepository.lockById(tx, heroId);
    if (!hero) {
      throw new DomainError('not_found', 'HERO_NOT_FOUND', 'Herói não encontrado.');
    }
    if (!hero.is_active) {
      throw new DomainError(
        'conflict',
        'HERO_INACTIVE',
        'Herói inativo não pode ser escalado em missão.',
      );
    }
    return hero;
  }

  /**
   * Cross-feature hydration helper for missions:
   * Returns a map of heroId -> nickname for all requested IDs,
   * preserving nicknames even for soft-deleted heroes.
   */
  async findNicknames(heroIds: readonly string[]): Promise<Map<string, string>> {
    return this.heroRepository.findNicknames(heroIds);
  }

  /**
   * Cross-feature batch insertion helper for imports:
   * Executes INSERT IGNORE for up to 500 rows, returning the newly inserted count.
   */
  async insertBatch(inputs: readonly HeroBatchInsertInput[]): Promise<number> {
    return this.heroRepository.insertMany(inputs);
  }
}
