import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetMissionUseCase, validateMissionId } from './get-mission.use-case.js';
import { DomainError } from '../../../../core/errors/domain.exception.js';
import { MissionEntity } from '../../domain/entities/mission.entity.js';
import type { IMissionRepository } from '../../domain/ports/mission-repository.port.js';

describe('GetMissionUseCase', () => {
  let mockRepo: {
    findById: ReturnType<typeof vi.fn>;
  };
  let useCase: GetMissionUseCase;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
    };
    useCase = new GetMissionUseCase(mockRepo as unknown as IMissionRepository);
  });

  it('should return mission entity when found', async () => {
    const validId = '00000000-0000-4000-8000-000000000001';
    const mission = new MissionEntity({
      id: validId,
      title: 'Operação Budapeste',
      starts_at: new Date('2026-11-03T10:00:00.000Z'),
      ends_at: new Date('2026-11-03T12:00:00.000Z'),
      status: 'scheduled',
      heroes: [],
    });
    mockRepo.findById.mockResolvedValueOnce(mission);

    const result = await useCase.execute(validId);
    expect(result).toBe(mission);
    expect(mockRepo.findById).toHaveBeenCalledWith(validId);
  });

  it('should throw validation error on invalid UUID', async () => {
    await expect(useCase.execute('invalid-uuid')).rejects.toThrowError(
      DomainError,
    );
    try {
      await useCase.execute('invalid-uuid');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).extra.fields).toEqual([
        { field: 'id', message: 'Identificador de missão inválido.' },
      ]);
    }
    expect(mockRepo.findById).not.toHaveBeenCalled();
  });

  it('should throw 404 MISSION_NOT_FOUND when mission is missing', async () => {
    const validId = '00000000-0000-4000-8000-000000000001';
    mockRepo.findById.mockResolvedValueOnce(null);

    await expect(useCase.execute(validId)).rejects.toThrowError(DomainError);
    try {
      await useCase.execute(validId);
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('MISSION_NOT_FOUND');
      expect((err as DomainError).kind).toBe('not_found');
    }
  });

  describe('validateMissionId', () => {
    it('should validate valid UUID', () => {
      expect(() =>
        validateMissionId('00000000-0000-4000-8000-000000000001'),
      ).not.toThrow();
    });

    it('should reject invalid UUID string', () => {
      expect(() => validateMissionId('abc')).toThrowError(DomainError);
    });
  });
});
