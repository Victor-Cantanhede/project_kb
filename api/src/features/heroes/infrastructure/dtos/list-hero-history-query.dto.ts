import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  HISTORY_FIELDS,
  type HistoryField,
} from '../../domain/entities/hero.entity.js';

export class ListHeroHistoryQueryDto {
  @IsOptional()
  @IsIn(HISTORY_FIELDS, { message: 'Campo de histórico inválido.' })
  field?: HistoryField;

  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined,
  )
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;
}
