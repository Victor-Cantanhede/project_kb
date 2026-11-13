import { Inject, Injectable } from '@nestjs/common';
import { DomainError, validationError } from '../../../../core/errors/domain.exception.js';
import { MysqlTransactionManager } from '../../../../core/database/mysql-transaction.manager.js';
import type { HeroEntity } from '../../domain/entities/hero.entity.js';
import {
  HERO_REPOSITORY_TOKEN,
  type HeroUpdateInput,
  type IHeroRepository,
} from '../../domain/ports/hero-repository.port.js';
import { todayIn } from '../../domain/utils/calendar-date.validator.js';
import { diffHero } from '../../domain/utils/hero-diff.util.js';
import type { UpdateHeroDto } from '../../infrastructure/dtos/update-hero.dto.js';
import { DEFAULT_TIME_ZONE } from './create-hero.use-case.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateHeroId(id: string): void {
  if (!UUID_REGEX.test(id)) {
    throw validationError([{ field: 'id', message: 'Identificador de herói inválido.' }]);
  }
}

@Injectable()
export class UpdateHeroUseCase {
  constructor(
    @Inject(HERO_REPOSITORY_TOKEN)
    private readonly heroRepository: IHeroRepository,
    @Inject(MysqlTransactionManager)
    private readonly txManager: MysqlTransactionManager,
  ) {}

  async execute(
    id: string,
    dto: UpdateHeroDto,
    timeZone?: string,
  ): Promise<HeroEntity> {
    validateHeroId(id);

    const zone = timeZone ?? DEFAULT_TIME_ZONE;
    const today = todayIn(zone, new Date(), DEFAULT_TIME_ZONE);

    if (dto.date_of_birth && dto.date_of_birth > today) {
      throw validationError([
        {
          field: 'date_of_birth',
          message: 'A data de nascimento não pode ser no futuro.',
        },
      ]);
    }

    return this.txManager.run(async (tx) => {
      const current = await this.heroRepository.lockById(tx, id);
      if (!current) {
        throw new DomainError('not_found', 'HERO_NOT_FOUND', 'Herói não encontrado.');
      }

      if (!current.is_active) {
        throw new DomainError('conflict', 'HERO_INACTIVE', 'Herói inativo não pode ser editado.');
      }

      if (dto.version !== current.version) {
        throw new DomainError(
          'conflict',
          'HERO_VERSION_CONFLICT',
          'Este herói foi alterado depois que você abriu a edição. Atualize os dados sem perder o que digitou.',
          { details: { current_hero: current } },
        );
      }

      const changes = diffHero(current, dto);
      if (changes.length === 0) {
        return current;
      }

      const values: HeroUpdateInput = {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.nickname !== undefined ? { nickname: dto.nickname } : {}),
        ...(dto.date_of_birth !== undefined ? { date_of_birth: dto.date_of_birth } : {}),
        ...(dto.universe !== undefined ? { universe: dto.universe } : {}),
        ...(dto.main_power !== undefined ? { main_power: dto.main_power } : {}),
        ...(dto.avatar_url !== undefined ? { avatar_url: dto.avatar_url } : {}),
      };

      const status = await this.heroRepository.update(tx, id, values, changes);
      if (status === 'duplicate_hero') {
        throw new DomainError(
          'conflict',
          'DUPLICATE_HERO',
          'Já existe um herói com este nome, nome de guerra e data de nascimento.',
        );
      }

      const updated = await this.heroRepository.lockById(tx, id);
      if (!updated) {
        throw validationError([{ field: 'id', message: 'Herói não encontrado.' }]);
      }
      return updated;
    });
  }
}
