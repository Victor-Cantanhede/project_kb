import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateHeroUseCase, hashCreatePayload } from './create-hero.use-case.js';
import type { IHeroRepository } from '../../domain/ports/hero-repository.port.js';
import { DomainError } from '../../../../core/errors/domain.exception.js';
import { HeroEntity } from '../../domain/entities/hero.entity.js';

describe('CreateHeroUseCase', () => {
  let mockRepo: {
    insert: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByIdempotencyKey: ReturnType<typeof vi.fn>;
  };
  let useCase: CreateHeroUseCase;

  const validDto = {
    name: 'Robert Bruce Banner',
    nickname: 'Hulk',
    date_of_birth: '1962-04-10',
    universe: 'Marvel',
    main_power: 'Força',
    avatar_url: null,
  };

  const createdHero = new HeroEntity({
    id: 'hero-123',
    ...validDto,
    is_active: true,
    version: 1,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    deleted_at: null,
  });

  beforeEach(() => {
    mockRepo = {
      insert: vi.fn(),
      findById: vi.fn(),
      findByIdempotencyKey: vi.fn(),
    };
    useCase = new CreateHeroUseCase(mockRepo as unknown as IHeroRepository);
  });

  it('should create hero and return created: true on first attempt', async () => {
    mockRepo.insert.mockResolvedValueOnce({ kind: 'created', id: 'hero-123' });
    mockRepo.findById.mockResolvedValueOnce(createdHero);

    const result = await useCase.execute(validDto);

    expect(result.created).toBe(true);
    expect(result.hero).toEqual(createdHero);
    expect(mockRepo.insert).toHaveBeenCalledWith(validDto, { key: null, hash: null });
    expect(mockRepo.findById).toHaveBeenCalledWith('hero-123');
  });

  it('should reject future date of birth with VALIDATION_ERROR', async () => {
    const futureDto = {
      ...validDto,
      date_of_birth: '2099-01-01',
    };

    await expect(useCase.execute(futureDto)).rejects.toThrow(DomainError);
    expect(mockRepo.insert).not.toHaveBeenCalled();
  });

  it('should reject invalid idempotency keys (whitespace, > 100, non-ascii)', async () => {
    await expect(
      useCase.execute(validDto, { idempotencyKey: '   ' }),
    ).rejects.toThrow(DomainError);

    await expect(
      useCase.execute(validDto, { idempotencyKey: 'a'.repeat(101) }),
    ).rejects.toThrow(DomainError);

    await expect(
      useCase.execute(validDto, { idempotencyKey: 'key with spaces' }),
    ).rejects.toThrow(DomainError);

    expect(mockRepo.insert).not.toHaveBeenCalled();
  });

  it('should return existing hero with created: false on idempotent retry with matching hash', async () => {
    mockRepo.insert.mockResolvedValueOnce({ kind: 'duplicate_idempotency_key' });
    mockRepo.findByIdempotencyKey.mockResolvedValueOnce({
      hero: createdHero,
      requestHash: hashCreatePayload(validDto),
    });

    const result = await useCase.execute(validDto, { idempotencyKey: 'key-123' });

    expect(result.created).toBe(false);
    expect(result.hero).toEqual(createdHero);
    expect(mockRepo.findByIdempotencyKey).toHaveBeenCalledWith('key-123');
  });

  it('should throw 409 IDEMPOTENCY_KEY_CONFLICT when key is reused with different payload', async () => {
    mockRepo.insert.mockResolvedValueOnce({ kind: 'duplicate_idempotency_key' });
    mockRepo.findByIdempotencyKey.mockResolvedValueOnce({
      hero: createdHero,
      requestHash: 'different-hash',
    });

    await expect(
      useCase.execute(validDto, { idempotencyKey: 'key-123' }),
    ).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_CONFLICT',
    });
  });

  it('should throw 404 HERO_NOT_FOUND when idempotent hero was deleted', async () => {
    mockRepo.insert.mockResolvedValueOnce({ kind: 'duplicate_idempotency_key' });
    mockRepo.findByIdempotencyKey.mockResolvedValueOnce({
      hero: null,
      requestHash: hashCreatePayload(validDto),
    });

    await expect(
      useCase.execute(validDto, { idempotencyKey: 'key-123' }),
    ).rejects.toMatchObject({
      code: 'HERO_NOT_FOUND',
    });
  });

  it('should throw 409 DUPLICATE_HERO when duplicate identity occurs', async () => {
    mockRepo.insert.mockResolvedValueOnce({ kind: 'duplicate_hero' });

    await expect(useCase.execute(validDto)).rejects.toMatchObject({
      code: 'DUPLICATE_HERO',
    });
  });
});
