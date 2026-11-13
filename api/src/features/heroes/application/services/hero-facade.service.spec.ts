import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HeroFacadeService } from './hero-facade.service.js';
import type { IHeroRepository } from '../../domain/ports/hero-repository.port.js';
import { HeroEntity } from '../../domain/entities/hero.entity.js';

describe('HeroFacadeService', () => {
  let mockRepo: {
    findById: ReturnType<typeof vi.fn>;
    lockById: ReturnType<typeof vi.fn>;
    findNicknames: ReturnType<typeof vi.fn>;
    insertMany: ReturnType<typeof vi.fn>;
  };
  let facade: HeroFacadeService;

  const validHeroId = 'e314636e-1ca6-4925-a0e7-da5eb5ae2403';

  const activeHero = new HeroEntity({
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
      lockById: vi.fn(),
      findNicknames: vi.fn(),
      insertMany: vi.fn(),
    };
    facade = new HeroFacadeService(mockRepo as unknown as IHeroRepository);
  });

  describe('parseHeroId', () => {
    it('should return valid UUID', () => {
      expect(facade.parseHeroId(validHeroId)).toBe(validHeroId);
    });

    it('should throw 400 VALIDATION_ERROR on field id for invalid UUID', () => {
      expect(() => facade.parseHeroId('invalid-uuid')).toThrow();
    });
  });

  describe('getById', () => {
    it('should retrieve hero by id', async () => {
      mockRepo.findById.mockResolvedValueOnce(activeHero);
      const hero = await facade.getById(validHeroId);
      expect(hero).toEqual(activeHero);
      expect(mockRepo.findById).toHaveBeenCalledWith(validHeroId);
    });
  });

  describe('lockActiveHeroForMission', () => {
    const dummyTx = {} as any;

    it('should lock and return active hero', async () => {
      mockRepo.lockById.mockResolvedValueOnce(activeHero);

      const hero = await facade.lockActiveHeroForMission(dummyTx, validHeroId);
      expect(hero).toEqual(activeHero);
      expect(mockRepo.lockById).toHaveBeenCalledWith(dummyTx, validHeroId);
    });

    it('should throw 404 HERO_NOT_FOUND when hero not found in lock', async () => {
      mockRepo.lockById.mockResolvedValueOnce(null);

      await expect(
        facade.lockActiveHeroForMission(dummyTx, validHeroId),
      ).rejects.toMatchObject({
        code: 'HERO_NOT_FOUND',
      });
    });

    it('should throw 409 HERO_INACTIVE when hero is inactive', async () => {
      const inactive = new HeroEntity({
        ...activeHero,
        is_active: false,
      });
      mockRepo.lockById.mockResolvedValueOnce(inactive);

      await expect(
        facade.lockActiveHeroForMission(dummyTx, validHeroId),
      ).rejects.toMatchObject({
        code: 'HERO_INACTIVE',
        message: 'Herói inativo não pode ser escalado em missão.',
      });
    });
  });

  describe('findNicknames', () => {
    it('should delegate to repo.findNicknames', async () => {
      const map = new Map([[validHeroId, 'Hulk']]);
      mockRepo.findNicknames.mockResolvedValueOnce(map);

      const result = await facade.findNicknames([validHeroId]);
      expect(result).toBe(map);
      expect(mockRepo.findNicknames).toHaveBeenCalledWith([validHeroId]);
    });
  });

  describe('insertBatch', () => {
    it('should delegate to repo.insertMany', async () => {
      mockRepo.insertMany.mockResolvedValueOnce(5);

      const inputs = [
        {
          name: 'H1',
          nickname: 'N1',
          date_of_birth: '1990-01-01',
          universe: 'Marvel',
          main_power: 'P1',
          avatar_url: null,
        },
      ];

      const count = await facade.insertBatch(inputs);
      expect(count).toBe(5);
      expect(mockRepo.insertMany).toHaveBeenCalledWith(inputs);
    });
  });
});
