import { Transform } from 'class-transformer';
import { MISSION_TITLE_MAX } from '../../domain/entities/mission.entity.js';
import { IsNotBlankText } from '../validators/is-not-blank-text.decorator.js';
import { IsIsoDateTime } from '../validators/is-iso-datetime.decorator.js';
import { IsAfterDate } from '../validators/is-after-date.decorator.js';

export class CreateMissionDto {
  @IsNotBlankText('o título da missão', MISSION_TITLE_MAX)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @IsIsoDateTime('início')
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  starts_at!: string;

  @IsIsoDateTime('término')
  @IsAfterDate('starts_at')
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  ends_at!: string;
}
