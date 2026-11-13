import type {
  MissionEntity,
  MissionHeroSummary,
  MissionStatus,
} from '../../domain/entities/mission.entity.js';

export class MissionResponseDto {
  id!: string;
  title!: string;
  starts_at!: string;
  ends_at!: string;
  status!: MissionStatus;
  heroes!: readonly MissionHeroSummary[];

  static fromEntity(entity: MissionEntity): MissionResponseDto {
    const dto = new MissionResponseDto();
    dto.id = entity.id;
    dto.title = entity.title;
    dto.starts_at =
      entity.starts_at instanceof Date
        ? entity.starts_at.toISOString()
        : new Date(entity.starts_at).toISOString();
    dto.ends_at =
      entity.ends_at instanceof Date
        ? entity.ends_at.toISOString()
        : new Date(entity.ends_at).toISOString();
    dto.status = entity.status;
    dto.heroes = entity.heroes.map((h) => ({
      id: h.id,
      nickname: h.nickname,
    }));
    return dto;
  }
}
