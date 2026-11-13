import { Transform } from 'class-transformer';
import { IsUUID } from 'class-validator';

export class AssignHeroDto {
  @IsUUID(undefined, {
    message: 'Informe um identificador de herói válido.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  hero_id!: string;
}
