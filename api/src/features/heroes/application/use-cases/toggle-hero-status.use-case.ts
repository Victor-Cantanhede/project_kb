import { Inject, Injectable } from '@nestjs/common';
import { DomainError, validationError } from '../../../../core/errors/domain.exception.js';
import { MysqlTransactionManager } from '../../../../core/database/mysql-transaction.manager.js';
import type { HeroEntity } from '../../domain/entities/hero.entity.js';
import {
  HERO_REPOSITORY_TOKEN,
  type IHeroRepository,
} from '../../domain/ports/hero-repository.port.js';
import { activationChange } from '../../domain/utils/hero-diff.util.js';
import { validateHeroId } from './update-hero.use-case.js';

@Injectable()
export class ToggleHeroStatusUseCase {
  constructor(
    @Inject(HERO_REPOSITORY_TOKEN)
    private readonly heroRepository: IHeroRepository,
    @Inject(MysqlTransactionManager)
    private readonly txManager: MysqlTransactionManager,
  ) {}

  async execute(id: string, active: boolean): Promise<HeroEntity> {
    validateHeroId(id);

    return this.txManager.run(async (tx) => {
      const current = await this.heroRepository.lockById(tx, id);
      if (!current) {
        throw new DomainError('not_found', 'HERO_NOT_FOUND', 'Herói não encontrado.');
      }

      if (current.is_active === active) {
        const msg = active
          ? 'Este herói já está ativo.'
          : 'Este herói já está inativo.';
        throw new DomainError(
          'conflict',
          active ? 'HERO_ALREADY_ACTIVE' : 'HERO_ALREADY_INACTIVE',
          msg,
        );
      }

      await this.heroRepository.update(
        tx,
        id,
        { is_active: active },
        [activationChange(current, active)],
      );

      const updated = await this.heroRepository.lockById(tx, id);
      if (!updated) {
        throw validationError([{ field: 'id', message: 'Herói não encontrado.' }]);
      }
      return updated;
    });
  }
}
