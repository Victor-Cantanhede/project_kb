import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListHeroHistoryUseCase } from './list-hero-history.use-case.js';
import type { IHeroRepository } from '../../domain/ports/hero-repository.port.js';
import { HeroEntity } from '../../domain/entities/hero.entity.js';
import { HeroHistoryEntity } from '../../domain/entities/hero-history.entity.js';
import { encodeCursor } from '../../../../core/pagination/keyset-pagination.js';

describe('ListHeroHistoryUseCase', () => {
  let mockRepo: {
    findById: ReturnType<typeof vi.fn>;
    listHistory: ReturnType<typeof vi.fn>;
  };
  let useCase: ListHeroHistoryUseCase;

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

  const entry1 = new HeroHistoryEntity({
    id: '2',
    hero_id: validHeroId,
    field: 'nickname',
    old_value: 'Hulk',
    new_value: 'Hulk Verde',
    changed_at: new Date('2026-01-02T12:00:00.000Z'),
  });

  const entry2 = new HeroHistoryEntity({
    id: '1',
    hero_id: validHeroId,
    field: 'main_power',
    old_value: 'Força',
    new_value: 'Super Força',
    changed_at: new Date('2026-01-01T12:00:00.000Z'),
  });

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      listHistory: vi.fn(),
    };
    useCase = new ListHeroHistoryUseCase(mockRepo as unknown as IHeroRepository);
  });

  it('should reject invalid hero UUID with VALIDATION_ERROR', async () => {
    await expect(useCase.execute('invalid-id', { limit: 10 })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('should throw 404 HERO_NOT_FOUND when hero does not exist or is deleted', async () => {
    mockRepo.findById.mockResolvedValueOnce(null);

    await expect(useCase.execute(validHeroId, { limit: 10 })).rejects.toMatchObject({
      code: 'HERO_NOT_FOUND',
    });
  });

  it('should list hero history with cursor pagination', async () => {
    mockRepo.findById.mockResolvedValueOnce(hero);
    mockRepo.listHistory.mockResolvedValueOnce([entry1, entry2]);

    const page = await useCase.execute(validHeroId, { limit: 1, field: 'nickname' });

    expect(mockRepo.listHistory).toHaveBeenCalledWith(validHeroId, {
      field: 'nickname',
      after: null,
      limit: 2,
    });
    expect(page.data).toEqual([entry1]);
    expect(page.next_cursor).toBe(
      encodeCursor({ at: entry1.changed_at, id: entry1.id }),
    );
  });
});
