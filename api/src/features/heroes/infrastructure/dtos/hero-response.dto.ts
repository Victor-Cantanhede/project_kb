import type { HeroEntity } from '../../domain/entities/hero.entity.js';

export class HeroResponseDto {
  id!: string;
  name!: string;
  nickname!: string;
  date_of_birth!: string;
  universe!: string;
  main_power!: string;
  avatar_url!: string | null;
  is_active!: boolean;
  version!: number;
  created_at!: Date;
  updated_at!: Date;

  static fromEntity(entity: HeroEntity): HeroResponseDto {
    const dto = new HeroResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.nickname = entity.nickname;
    dto.date_of_birth = entity.date_of_birth;
    dto.universe = entity.universe;
    dto.main_power = entity.main_power;
    dto.avatar_url = entity.avatar_url;
    dto.is_active = entity.is_active;
    dto.version = entity.version;
    dto.created_at = entity.created_at;
    dto.updated_at = entity.updated_at;
    return dto;
  }
}
