import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetHeroUseCase } from './get-hero.use-case.js';
import type { IHeroRepository } from '../../domain/ports/hero-repository.port.js';
import { HeroEntity } from '../../domain/entities/hero.entity.js';

describe('GetHeroUseCase', () => {
  let mockRepo: {
    findById: ReturnType<typeof vi.fn>;
  };
  let useCase: GetHeroUseCase;

  const validHeroId = 'e314636e-1ca6-4925-a0e7-da5eb5ae2403';

  const hero = new HeroEntity({
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
      findById: vi.fn(),
    };
    useCase = new GetHeroUseCase(mockRepo as unknown as IHeroRepository);
  });

  it('should reject invalid UUID with VALIDATION_ERROR', async () => {
    await expect(useCase.execute('invalid-id')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('should throw 404 HERO_NOT_FOUND when hero does not exist or is soft deleted', async () => {
    mockRepo.findById.mockResolvedValueOnce(null);

    await expect(useCase.execute(validHeroId)).rejects.toMatchObject({
      code: 'HERO_NOT_FOUND',
    });
  });

  it('should return hero when found', async () => {
    mockRepo.findById.mockResolvedValueOnce(hero);

    const result = await useCase.execute(validHeroId);
    expect(result).toEqual(hero);
    expect(mockRepo.findById).toHaveBeenCalledWith(validHeroId);
  });
});
