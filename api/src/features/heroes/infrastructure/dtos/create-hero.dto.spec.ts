import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateHeroDto } from './create-hero.dto.js';
import { HERO_LIMITS } from '../../domain/entities/hero.entity.js';

describe('CreateHeroDto', () => {
  function toDto(plain: Record<string, unknown>): CreateHeroDto {
    return plainToInstance(CreateHeroDto, plain);
  }

  it('should accept valid hero payload', async () => {
    const dto = toDto({
      name: 'Robert Bruce Banner',
      nickname: 'Hulk',
      date_of_birth: '1962-04-10',
      universe: 'Marvel',
      main_power: 'Super Força',
      avatar_url: '/api/avatars/e314636e-1ca6-4925-a0e7-da5eb5ae2403',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should trim string fields and treat empty avatar_url as null', async () => {
    const dto = toDto({
      name: '  Tony Stark  ',
      nickname: '  Iron Man  ',
      date_of_birth: '1970-05-29',
      universe: '  Marvel  ',
      main_power: '  Inteligência  ',
      avatar_url: '   ',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.name).toBe('Tony Stark');
    expect(dto.nickname).toBe('Iron Man');
    expect(dto.universe).toBe('Marvel');
    expect(dto.main_power).toBe('Inteligência');
    expect(dto.avatar_url).toBeNull();
  });

  it('should reject whitespace-only required fields', async () => {
    const dto = toDto({
      name: '   \t\n  ',
      nickname: '',
      date_of_birth: '',
      universe: '  ',
      main_power: ' \n ',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(5);
    const errorMap = Object.fromEntries(
      errors.map((e) => [e.property, Object.values(e.constraints ?? {})[0]]),
    );

    expect(errorMap.name).toBe('Informe o nome completo.');
    expect(errorMap.nickname).toBe('Informe o nome de guerra.');
    expect(errorMap.date_of_birth).toBe('Informe a data de nascimento.');
    expect(errorMap.universe).toBe('Informe o universo.');
    expect(errorMap.main_power).toBe('Informe a habilidade.');
  });

  it('should reject fields exceeding length boundaries', async () => {
    const dto = toDto({
      name: 'A'.repeat(HERO_LIMITS.name + 1),
      nickname: 'B'.repeat(HERO_LIMITS.nickname + 1),
      date_of_birth: '1990-01-01',
      universe: 'C'.repeat(HERO_LIMITS.universe + 1),
      main_power: 'D'.repeat(HERO_LIMITS.main_power + 1),
      avatar_url: 'https://example.com/' + 'x'.repeat(2048),
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(5);
    const errorMap = Object.fromEntries(
      errors.map((e) => [e.property, Object.values(e.constraints ?? {})[0]]),
    );

    expect(errorMap.name).toBe(`Use no máximo ${HERO_LIMITS.name} caracteres.`);
    expect(errorMap.nickname).toBe(`Use no máximo ${HERO_LIMITS.nickname} caracteres.`);
    expect(errorMap.universe).toBe(`Use no máximo ${HERO_LIMITS.universe} caracteres.`);
    expect(errorMap.main_power).toBe(`Use no máximo ${HERO_LIMITS.main_power} caracteres.`);
    expect(errorMap.avatar_url).toBe('Use no máximo 2048 caracteres.');
  });

  it('should reject control characters in text fields', async () => {
    const dto = toDto({
      name: 'Peter\u0000Parker',
      nickname: 'Homem\u0007Aranha',
      date_of_birth: '2001-08-10',
      universe: 'Marvel\u001F',
      main_power: 'Voo',
    });

    const errors = await validate(dto);
    const errorMap = Object.fromEntries(
      errors.map((e) => [e.property, Object.values(e.constraints ?? {})[0]]),
    );

    expect(errorMap.name).toBe('Contém caracteres inválidos.');
    expect(errorMap.nickname).toBe('Contém caracteres inválidos.');
    expect(errorMap.universe).toBe('Contém caracteres inválidos.');
  });

  it('should reject invalid calendar dates and dates before 1000-01-01', async () => {
    const invalidCalendarDto = toDto({
      name: 'Steve Rogers',
      nickname: 'Capitão América',
      date_of_birth: '2025-02-29', // not a leap year
      universe: 'Marvel',
      main_power: 'Super Soldado',
    });

    const ancientDto = toDto({
      name: 'Steve Rogers',
      nickname: 'Capitão América',
      date_of_birth: '0999-12-31', // before year 1000
      universe: 'Marvel',
      main_power: 'Super Soldado',
    });

    const errors1 = await validate(invalidCalendarDto);
    expect(errors1[0]?.constraints?.isCalendarDate).toBe('Use uma data válida no formato AAAA-MM-DD.');

    const errors2 = await validate(ancientDto);
    expect(errors2[0]?.constraints?.isCalendarDate).toBe('A data de nascimento deve ser a partir do ano 1000.');
  });

  it('should reject unsafe avatar URLs (javascript:, data:) and invalid URLs', async () => {
    const xssDto = toDto({
      name: 'Peter Parker',
      nickname: 'Homem-Aranha',
      date_of_birth: '2001-08-10',
      universe: 'Marvel',
      main_power: 'Sentido Aranha',
      avatar_url: 'javascript:alert(1)',
    });

    const dataUriDto = toDto({
      name: 'Peter Parker',
      nickname: 'Homem-Aranha',
      date_of_birth: '2001-08-10',
      universe: 'Marvel',
      main_power: 'Sentido Aranha',
      avatar_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    });

    const errors1 = await validate(xssDto);
    expect(errors1[0]?.constraints?.isValidAvatarUrl).toBe('Informe uma URL http(s) válida.');

    const errors2 = await validate(dataUriDto);
    expect(errors2[0]?.constraints?.isValidAvatarUrl).toBe('Informe uma URL http(s) válida.');
  });
});
