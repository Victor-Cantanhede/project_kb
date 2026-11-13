import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DomainError, validationError } from '../../../../core/errors/domain.exception.js';
import type { HeroEntity } from '../../domain/entities/hero.entity.js';
import {
  HERO_REPOSITORY_TOKEN,
  type IHeroRepository,
} from '../../domain/ports/hero-repository.port.js';
import { todayIn } from '../../domain/utils/calendar-date.validator.js';
import type { CreateHeroDto } from '../../infrastructure/dtos/create-hero.dto.js';

export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

export function hashCreatePayload(input: {
  name: string;
  nickname: string;
  date_of_birth: string;
  universe: string;
  main_power: string;
  avatar_url?: string | null;
}): string {
  const canonical = JSON.stringify([
    input.name.toLowerCase(),
    input.nickname.toLowerCase(),
    input.date_of_birth,
    input.universe.toLowerCase(),
    input.main_power.toLowerCase(),
    input.avatar_url ?? '',
  ]);
  return createHash('sha256').update(canonical).digest('hex');
}

export function validateIdempotencyKey(key: string): void {
  const trimmed = key.trim();
  if (trimmed.length === 0) {
    throw validationError([
      { field: 'idempotency_key', message: 'Chave de idempotência vazia.' },
    ]);
  }
  if (trimmed.length > 100) {
    throw validationError([
      {
        field: 'idempotency_key',
        message: 'Chave de idempotência deve ter no máximo 100 caracteres.',
      },
    ]);
  }
  if (!/^[\x21-\x7E]+$/.test(trimmed)) {
    throw validationError([
      {
        field: 'idempotency_key',
        message: 'Chave de idempotência deve conter apenas caracteres ASCII visíveis.',
      },
    ]);
  }
}

export interface CreateHeroOptions {
  readonly idempotencyKey?: string | undefined;
  readonly timeZone?: string | undefined;
}

export interface CreateHeroResult {
  readonly hero: HeroEntity;
  readonly created: boolean;
}

@Injectable()
export class CreateHeroUseCase {
  constructor(
    @Inject(HERO_REPOSITORY_TOKEN)
    private readonly heroRepository: IHeroRepository,
  ) {}

  async execute(
    dto: CreateHeroDto,
    options: CreateHeroOptions = {},
  ): Promise<CreateHeroResult> {
    const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
    const today = todayIn(timeZone, new Date(), DEFAULT_TIME_ZONE);

    if (dto.date_of_birth > today) {
      throw validationError([
        {
          field: 'date_of_birth',
          message: 'A data de nascimento não pode ser no futuro.',
        },
      ]);
    }

    let key: string | null = null;
    let hash: string | null = null;

    if (options.idempotencyKey !== undefined && options.idempotencyKey !== null) {
      validateIdempotencyKey(options.idempotencyKey);
      key = options.idempotencyKey.trim();
      hash = hashCreatePayload(dto);
    }

    const outcome = await this.heroRepository.insert(dto, { key, hash });

    if (outcome.kind === 'created') {
      const hero = await this.heroRepository.findById(outcome.id);
      if (!hero) {
        throw new DomainError('not_found', 'HERO_NOT_FOUND', 'Herói não encontrado.');
      }
      return { hero, created: true };
    }

    if (outcome.kind === 'duplicate_idempotency_key' && key && hash) {
      return this.resolveIdempotentRetry(key, hash);
    }

    throw new DomainError(
      'conflict',
      'DUPLICATE_HERO',
      'Já existe um herói com este nome, nome de guerra e data de nascimento.',
    );
  }

  private async resolveIdempotentRetry(
    key: string,
    hash: string,
  ): Promise<CreateHeroResult> {
    const previous = await this.heroRepository.findByIdempotencyKey(key);
    if (!previous || previous.requestHash !== hash) {
      throw new DomainError(
        'conflict',
        'IDEMPOTENCY_KEY_CONFLICT',
        'Esta chave de idempotência já foi usada com outros dados.',
      );
    }
    if (!previous.hero) {
      throw new DomainError(
        'not_found',
        'HERO_NOT_FOUND',
        'O herói criado anteriormente com esta chave foi excluído.',
      );
    }
    return { hero: previous.hero, created: false };
  }
}
