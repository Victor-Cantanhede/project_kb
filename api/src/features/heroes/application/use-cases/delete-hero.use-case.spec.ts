import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteHeroUseCase } from './delete-hero.use-case.js';
import type { IHeroRepository } from '../../domain/ports/hero-repository.port.js';
import type { MysqlTransactionManager } from '../../../../core/database/mysql-transaction.manager.js';
import { HeroEntity } from '../../domain/entities/hero.entity.js';

describe('DeleteHeroUseCase', () => {
  let mockRepo: {
    lockById: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
  };
  let mockTxManager: {
    run: ReturnType<typeof vi.fn>;
  };
  let useCase: DeleteHeroUseCase;

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
      lockById: vi.fn(),
      softDelete: vi.fn(),
    };
    mockTxManager = {
      run: vi.fn().mockImplementation((work: (tx: any) => Promise<any>) => work({})),
    };
    useCase = new DeleteHeroUseCase(
      mockRepo as unknown as IHeroRepository,
      mockTxManager as unknown as MysqlTransactionManager,
    );
  });

  it('should reject invalid UUID with VALIDATION_ERROR', async () => {
    await expect(useCase.execute('invalid-id')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('should throw 404 HERO_NOT_FOUND when locking missing hero', async () => {
    mockRepo.lockById.mockResolvedValueOnce(null);

    await expect(useCase.execute(validHeroId)).rejects.toMatchObject({
      code: 'HERO_NOT_FOUND',
    });
    expect(mockRepo.softDelete).not.toHaveBeenCalled();
  });

  it('should lock and soft delete hero', async () => {
    mockRepo.lockById.mockResolvedValueOnce(hero);
    mockRepo.softDelete.mockResolvedValueOnce(undefined);

    await useCase.execute(validHeroId);

    expect(mockRepo.lockById).toHaveBeenCalledWith(expect.anything(), validHeroId);
    expect(mockRepo.softDelete).toHaveBeenCalledWith(expect.anything(), validHeroId);
  });
});
