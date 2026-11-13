import { Transform } from 'class-transformer';
import { IsOptional } from 'class-validator';
import { HERO_LIMITS } from '../../domain/entities/hero.entity.js';
import { IsNotBlankText } from '../validators/is-not-blank-text.decorator.js';
import { IsValidAvatarUrl } from '../validators/is-valid-avatar-url.decorator.js';
import { IsCalendarDate } from '../validators/is-calendar-date.decorator.js';

export class CreateHeroDto {
  @IsNotBlankText('o nome completo', HERO_LIMITS.name)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @IsNotBlankText('o nome de guerra', HERO_LIMITS.nickname)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  nickname!: string;

  @IsCalendarDate()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  date_of_birth!: string;

  @IsNotBlankText('o universo', HERO_LIMITS.universe)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  universe!: string;

  @IsNotBlankText('a habilidade', HERO_LIMITS.main_power)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  main_power!: string;

  @IsOptional()
  @IsValidAvatarUrl()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === ''
      ? null
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  avatar_url?: string | null;
}
