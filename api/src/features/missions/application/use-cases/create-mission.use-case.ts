import { Inject, Injectable } from '@nestjs/common';
import type { MissionEntity } from '../../domain/entities/mission.entity.js';
import {
  MISSION_REPOSITORY_TOKEN,
  type IMissionRepository,
} from '../../domain/ports/mission-repository.port.js';
import type { CreateMissionDto } from '../../infrastructure/dtos/create-mission.dto.js';

@Injectable()
export class CreateMissionUseCase {
  constructor(
    @Inject(MISSION_REPOSITORY_TOKEN)
    private readonly missionRepo: IMissionRepository,
  ) {}

  async execute(dto: CreateMissionDto): Promise<MissionEntity> {
    return this.missionRepo.insert({
      title: dto.title,
      starts_at: new Date(dto.starts_at),
      ends_at: new Date(dto.ends_at),
    });
  }
}
