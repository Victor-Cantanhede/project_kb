import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToggleHeroStatusUseCase } from './toggle-hero-status.use-case.js';
import type { IHeroRepository } from '../../domain/ports/hero-repository.port.js';
import type { MysqlTransactionManager } from '../../../../core/database/mysql-transaction.manager.js';
import { HeroEntity } from '../../domain/entities/hero.entity.js';

describe('ToggleHeroStatusUseCase', () => {
  let mockRepo: {
    lockById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let mockTxManager: {
    run: ReturnType<typeof vi.fn>;
  };
  let useCase: ToggleHeroStatusUseCase;

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

  const inactiveHero = new HeroEntity({
    ...activeHero,
    is_active: false,
  });

  beforeEach(() => {
    mockRepo = {
      lockById: vi.fn(),
      update: vi.fn(),
    };
    mockTxManager = {
      run: vi.fn().mockImplementation((work: (tx: any) => Promise<any>) => work({})),
    };
    useCase = new ToggleHeroStatusUseCase(
      mockRepo as unknown as IHeroRepository,
      mockTxManager as unknown as MysqlTransactionManager,
    );
  });

  it('should reject invalid UUID with VALIDATION_ERROR', async () => {
    await expect(useCase.execute('invalid-uuid', true)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('should throw 404 HERO_NOT_FOUND when hero not found', async () => {
    mockRepo.lockById.mockResolvedValueOnce(null);

    await expect(useCase.execute(validHeroId, true)).rejects.toMatchObject({
      code: 'HERO_NOT_FOUND',
    });
  });

  it('should throw 409 HERO_ALREADY_ACTIVE when activating an already active hero', async () => {
    mockRepo.lockById.mockResolvedValueOnce(activeHero);

    await expect(useCase.execute(validHeroId, true)).rejects.toMatchObject({
      code: 'HERO_ALREADY_ACTIVE',
      message: 'Este herói já está ativo.',
    });
  });

  it('should throw 409 HERO_ALREADY_INACTIVE when deactivating an already inactive hero', async () => {
    mockRepo.lockById.mockResolvedValueOnce(inactiveHero);

    await expect(useCase.execute(validHeroId, false)).rejects.toMatchObject({
      code: 'HERO_ALREADY_INACTIVE',
      message: 'Este herói já está inativo.',
    });
  });

  it('should successfully activate an inactive hero and record activation history', async () => {
    mockRepo.lockById.mockResolvedValueOnce(inactiveHero);
    mockRepo.update.mockResolvedValueOnce('updated');

    const activatedHero = new HeroEntity({
      ...inactiveHero,
      is_active: true,
      version: 2,
    });
    mockRepo.lockById.mockResolvedValueOnce(activatedHero);

    const result = await useCase.execute(validHeroId, true);

    expect(result).toEqual(activatedHero);
    expect(mockRepo.update).toHaveBeenCalledWith(
      expect.anything(),
      validHeroId,
      { is_active: true },
      [
        {
          field: 'is_active',
          old_value: 'false',
          new_value: 'true',
        },
      ],
    );
  });

  it('should successfully deactivate an active hero and record deactivation history', async () => {
    mockRepo.lockById.mockResolvedValueOnce(activeHero);
    mockRepo.update.mockResolvedValueOnce('updated');

    const deactivatedHero = new HeroEntity({
      ...activeHero,
      is_active: false,
      version: 2,
    });
    mockRepo.lockById.mockResolvedValueOnce(deactivatedHero);

    const result = await useCase.execute(validHeroId, false);

    expect(result).toEqual(deactivatedHero);
    expect(mockRepo.update).toHaveBeenCalledWith(
      expect.anything(),
      validHeroId,
      { is_active: false },
      [
        {
          field: 'is_active',
          old_value: 'true',
          new_value: 'false',
        },
      ],
    );
  });
});
