import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  MISSION_STATUSES,
  type MissionStatus,
} from '../../domain/entities/mission.entity.js';

export class ListMissionsQueryDto {
  @IsOptional()
  @IsIn(MISSION_STATUSES)
  status?: MissionStatus;

  @IsOptional()
  @IsUUID(undefined, { message: 'Identificador de herói inválido.' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined,
  )
  hero_id?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined,
  )
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;
}
