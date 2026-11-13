import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListHeroesUseCase } from './list-heroes.use-case.js';
import type { IHeroRepository } from '../../domain/ports/hero-repository.port.js';
import { HeroEntity } from '../../domain/entities/hero.entity.js';
import { encodeCursor } from '../../../../core/pagination/keyset-pagination.js';

describe('ListHeroesUseCase', () => {
  let mockRepo: {
    list: ReturnType<typeof vi.fn>;
  };
  let useCase: ListHeroesUseCase;

  const hero1 = new HeroEntity({
    id: 'e314636e-1ca6-4925-a0e7-da5eb5ae2401',
    name: 'Hero One',
    nickname: 'H1',
    date_of_birth: '1990-01-01',
    universe: 'Marvel',
    main_power: 'Power 1',
    avatar_url: null,
    is_active: true,
    version: 1,
    created_at: new Date('2026-01-02T10:00:00.000Z'),
    updated_at: new Date('2026-01-02T10:00:00.000Z'),
    deleted_at: null,
  });

  const hero2 = new HeroEntity({
    id: 'e314636e-1ca6-4925-a0e7-da5eb5ae2402',
    name: 'Hero Two',
    nickname: 'H2',
    date_of_birth: '1992-02-02',
    universe: 'DC',
    main_power: 'Power 2',
    avatar_url: null,
    is_active: true,
    version: 1,
    created_at: new Date('2026-01-01T10:00:00.000Z'),
    updated_at: new Date('2026-01-01T10:00:00.000Z'),
    deleted_at: null,
  });

  beforeEach(() => {
    mockRepo = {
      list: vi.fn(),
    };
    useCase = new ListHeroesUseCase(mockRepo as unknown as IHeroRepository);
  });

  it('should list heroes without cursor and calculate next_cursor when more rows exist', async () => {
    // When limit is 1, repo is called with limit + 1 = 2
    mockRepo.list.mockResolvedValueOnce([hero1, hero2]);

    const page = await useCase.execute({ limit: 1 });

    expect(mockRepo.list).toHaveBeenCalledWith({
      search: null,
      after: null,
      limit: 2,
    });
    expect(page.data).toEqual([hero1]);
    expect(page.next_cursor).toBe(
      encodeCursor({ at: hero1.created_at, id: hero1.id }),
    );
  });

  it('should list heroes with cursor decoded and return null next_cursor when on last page', async () => {
    const cursor = encodeCursor({ at: hero1.created_at, id: hero1.id });
    mockRepo.list.mockResolvedValueOnce([hero2]);

    const page = await useCase.execute({ cursor, limit: 10 });

    expect(mockRepo.list).toHaveBeenCalledWith({
      search: null,
      after: { at: hero1.created_at, id: hero1.id },
      limit: 11,
    });
    expect(page.data).toEqual([hero2]);
    expect(page.next_cursor).toBeNull();
  });

  it('should pass search term to repository', async () => {
    mockRepo.list.mockResolvedValueOnce([]);

    await useCase.execute({ search: 'Hulk', limit: 10 });

    expect(mockRepo.list).toHaveBeenCalledWith({
      search: 'Hulk',
      after: null,
      limit: 11,
    });
  });
});
