import { Inject, Injectable } from '@nestjs/common';
import {
  DomainError,
  validationError,
} from '../../../../core/errors/domain.exception.js';
import type { MissionEntity } from '../../domain/entities/mission.entity.js';
import {
  MISSION_REPOSITORY_TOKEN,
  type IMissionRepository,
} from '../../domain/ports/mission-repository.port.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateMissionId(id: string): void {
  if (!UUID_REGEX.test(id)) {
    throw validationError([
      { field: 'id', message: 'Identificador de missão inválido.' },
    ]);
  }
}

@Injectable()
export class GetMissionUseCase {
  constructor(
    @Inject(MISSION_REPOSITORY_TOKEN)
    private readonly missionRepo: IMissionRepository,
  ) {}

  async execute(id: string): Promise<MissionEntity> {
    validateMissionId(id);
    const mission = await this.missionRepo.findById(id);
    if (!mission) {
      throw new DomainError(
        'not_found',
        'MISSION_NOT_FOUND',
        'Missão não encontrada.',
      );
    }
    return mission;
  }
}
