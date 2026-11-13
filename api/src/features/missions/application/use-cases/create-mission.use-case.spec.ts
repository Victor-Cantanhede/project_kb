import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateMissionUseCase } from './create-mission.use-case.js';
import { MissionEntity } from '../../domain/entities/mission.entity.js';
import type { IMissionRepository } from '../../domain/ports/mission-repository.port.js';

describe('CreateMissionUseCase', () => {
  let mockRepo: {
    insert: ReturnType<typeof vi.fn>;
  };
  let useCase: CreateMissionUseCase;

  beforeEach(() => {
    mockRepo = {
      insert: vi.fn(),
    };
    useCase = new CreateMissionUseCase(
      mockRepo as unknown as IMissionRepository,
    );
  });

  it('should call repository insert with parsed dates and return mission entity', async () => {
    const expectedMission = new MissionEntity({
      id: 'm-1',
      title: 'Operação Budapeste',
      starts_at: new Date('2026-11-03T10:00:00.000Z'),
      ends_at: new Date('2026-11-03T12:00:00.000Z'),
      status: 'scheduled',
      heroes: [],
    });
    mockRepo.insert.mockResolvedValueOnce(expectedMission);

    const result = await useCase.execute({
      title: 'Operação Budapeste',
      starts_at: '2026-11-03T10:00:00.000Z',
      ends_at: '2026-11-03T12:00:00.000Z',
    });

    expect(result).toBe(expectedMission);
    expect(mockRepo.insert).toHaveBeenCalledWith({
      title: 'Operação Budapeste',
      starts_at: new Date('2026-11-03T10:00:00.000Z'),
      ends_at: new Date('2026-11-03T12:00:00.000Z'),
    });
  });
});
