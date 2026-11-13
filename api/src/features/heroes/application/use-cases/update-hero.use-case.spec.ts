import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateHeroUseCase } from './update-hero.use-case.js';
import type { IHeroRepository } from '../../domain/ports/hero-repository.port.js';
import type { MysqlTransactionManager } from '../../../../core/database/mysql-transaction.manager.js';
import { DomainError } from '../../../../core/errors/domain.exception.js';
import { HeroEntity } from '../../domain/entities/hero.entity.js';

describe('UpdateHeroUseCase', () => {
  let mockRepo: {
    lockById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let mockTxManager: {
    run: ReturnType<typeof vi.fn>;
  };
  let useCase: UpdateHeroUseCase;

  const validHeroId = 'e314636e-1ca6-4925-a0e7-da5eb5ae2403';

  const currentHero = new HeroEntity({
    id: validHeroId,
    name: 'Robert Bruce Banner',
    nickname: 'Hulk',
    date_of_birth: '1962-04-10',
    universe: 'Marvel',
    main_power: 'Força',
    avatar_url: null,
    is_active: true,
    version: 1,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    deleted_at: null,
  });

  beforeEach(() => {
    mockRepo = {
      lockById: vi.fn(),
      update: vi.fn(),
    };
    mockTxManager = {
      run: vi.fn().mockImplementation((work: (tx: any) => Promise<any>) => work({})),
    };
    useCase = new UpdateHeroUseCase(
      mockRepo as unknown as IHeroRepository,
      mockTxManager as unknown as MysqlTransactionManager,
    );
  });

  it('should reject invalid UUID with VALIDATION_ERROR on field id', async () => {
    await expect(
      useCase.execute('not-a-uuid', { version: 1, nickname: 'New Hulk' }),
    ).rejects.toMatchObject({
      kind: 'validation',
      code: 'VALIDATION_ERROR',
      extra: {
        fields: [{ field: 'id', message: 'Identificador de herói inválido.' }],
      },
    });
  });

  it('should reject future date of birth with VALIDATION_ERROR on field date_of_birth', async () => {
    await expect(
      useCase.execute(validHeroId, {
        version: 1,
        date_of_birth: '2099-01-01',
      }),
    ).rejects.toMatchObject({
      kind: 'validation',
      code: 'VALIDATION_ERROR',
      extra: {
        fields: [{ field: 'date_of_birth', message: 'A data de nascimento não pode ser no futuro.' }],
      },
    });
  });

  it('should throw 404 HERO_NOT_FOUND when hero does not exist or is deleted', async () => {
    mockRepo.lockById.mockResolvedValueOnce(null);

    await expect(
      useCase.execute(validHeroId, { version: 1, nickname: 'New' }),
    ).rejects.toMatchObject({
      kind: 'not_found',
      code: 'HERO_NOT_FOUND',
    });
  });

  it('should throw 409 HERO_INACTIVE when editing an inactive hero', async () => {
    const inactiveHero = new HeroEntity({
      ...currentHero,
      is_active: false,
    });
    mockRepo.lockById.mockResolvedValueOnce(inactiveHero);

    await expect(
      useCase.execute(validHeroId, { version: 1, nickname: 'New' }),
    ).rejects.toMatchObject({
      kind: 'conflict',
      code: 'HERO_INACTIVE',
    });
  });

  it('should throw 409 HERO_VERSION_CONFLICT with current_hero details when version differs', async () => {
    mockRepo.lockById.mockResolvedValueOnce(currentHero); // version 1

    await expect(
      useCase.execute(validHeroId, { version: 2, nickname: 'New' }),
    ).rejects.toMatchObject({
      kind: 'conflict',
      code: 'HERO_VERSION_CONFLICT',
      extra: {
        details: {
          current_hero: currentHero,
        },
      },
    });
  });

  it('should return current hero without incrementing version when diff is empty', async () => {
    mockRepo.lockById.mockResolvedValueOnce(currentHero);

    const result = await useCase.execute(validHeroId, {
      version: 1,
      nickname: 'Hulk', // identical
    });

    expect(result).toEqual(currentHero);
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('should update hero with changes and return reloaded updated hero', async () => {
    mockRepo.lockById.mockResolvedValueOnce(currentHero);
    mockRepo.update.mockResolvedValueOnce('updated');

    const updatedHero = new HeroEntity({
      ...currentHero,
      nickname: 'Hulk Verde',
      version: 2,
    });
    mockRepo.lockById.mockResolvedValueOnce(updatedHero);

    const result = await useCase.execute(validHeroId, {
      version: 1,
      nickname: 'Hulk Verde',
    });

    expect(result).toEqual(updatedHero);
    expect(mockRepo.update).toHaveBeenCalledWith(
      expect.anything(),
      validHeroId,
      { nickname: 'Hulk Verde' },
      [
        {
          field: 'nickname',
          old_value: 'Hulk',
          new_value: 'Hulk Verde',
        },
      ],
    );
  });

  it('should throw 409 DUPLICATE_HERO when updating creates an identity collision', async () => {
    mockRepo.lockById.mockResolvedValueOnce(currentHero);
    mockRepo.update.mockResolvedValueOnce('duplicate_hero');

    await expect(
      useCase.execute(validHeroId, {
        version: 1,
        nickname: 'Thor',
      }),
    ).rejects.toMatchObject({
      kind: 'conflict',
      code: 'DUPLICATE_HERO',
    });
  });
});
