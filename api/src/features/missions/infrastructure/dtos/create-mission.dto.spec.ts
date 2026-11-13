import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateMissionDto } from './create-mission.dto.js';
import { MISSION_TITLE_MAX } from '../../domain/entities/mission.entity.js';

describe('CreateMissionDto', () => {
  function toDto(plain: Record<string, unknown>): CreateMissionDto {
    return plainToInstance(CreateMissionDto, plain);
  }

  it('should accept valid mission payload', async () => {
    const dto = toDto({
      title: 'Operação Budapeste',
      starts_at: '2026-11-03T10:00:00.000Z',
      ends_at: '2026-11-03T12:00:00.000Z',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should trim string fields', async () => {
    const dto = toDto({
      title: '   Operação Budapeste   ',
      starts_at: '  2026-11-03T10:00:00.000Z  ',
      ends_at: '  2026-11-03T12:00:00.000Z  ',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.title).toBe('Operação Budapeste');
    expect(dto.starts_at).toBe('2026-11-03T10:00:00.000Z');
    expect(dto.ends_at).toBe('2026-11-03T12:00:00.000Z');
  });

  it('should reject whitespace-only or empty title', async () => {
    const dto = toDto({
      title: '   \t\n   ',
      starts_at: '2026-11-03T10:00:00.000Z',
      ends_at: '2026-11-03T12:00:00.000Z',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(1);
    expect(errors[0]?.property).toBe('title');
    expect(Object.values(errors[0]?.constraints ?? {})[0]).toBe(
      'Informe o título da missão.',
    );
  });

  it('should reject title exceeding maximum length', async () => {
    const dto = toDto({
      title: 'M'.repeat(MISSION_TITLE_MAX + 1),
      starts_at: '2026-11-03T10:00:00.000Z',
      ends_at: '2026-11-03T12:00:00.000Z',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(1);
    expect(errors[0]?.property).toBe('title');
    expect(Object.values(errors[0]?.constraints ?? {})[0]).toBe(
      `Use no máximo ${MISSION_TITLE_MAX} caracteres.`,
    );
  });

  it('should reject title with control characters', async () => {
    const dto = toDto({
      title: 'Operação\u0000Budapeste',
      starts_at: '2026-11-03T10:00:00.000Z',
      ends_at: '2026-11-03T12:00:00.000Z',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(1);
    expect(errors[0]?.property).toBe('title');
    expect(Object.values(errors[0]?.constraints ?? {})[0]).toBe(
      'Contém caracteres inválidos.',
    );
  });

  it('should reject invalid starts_at formats', async () => {
    const notIso = toDto({
      title: 'Missão Alpha',
      starts_at: '2026-11-03', // date only, no time
      ends_at: '2026-11-03T12:00:00.000Z',
    });

    const garbage = toDto({
      title: 'Missão Alpha',
      starts_at: 'not-a-date',
      ends_at: '2026-11-03T12:00:00.000Z',
    });

    const errors1 = await validate(notIso);
    expect(errors1.some((e) => e.property === 'starts_at')).toBe(true);
    expect(Object.values(errors1[0]?.constraints ?? {})[0]).toBe(
      'Informe a data e hora de início em formato ISO 8601.',
    );

    const errors2 = await validate(garbage);
    expect(errors2.some((e) => e.property === 'starts_at')).toBe(true);
    expect(Object.values(errors2[0]?.constraints ?? {})[0]).toBe(
      'Informe a data e hora de início em formato ISO 8601.',
    );
  });

  it('should reject invalid ends_at formats', async () => {
    const dto = toDto({
      title: 'Missão Alpha',
      starts_at: '2026-11-03T10:00:00.000Z',
      ends_at: 'invalid-date',
    });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'ends_at')).toBe(true);
    const endsAtError = errors.find((e) => e.property === 'ends_at');
    expect(Object.values(endsAtError?.constraints ?? {})[0]).toBe(
      'Informe a data e hora de término em formato ISO 8601.',
    );
  });

  it('should reject when ends_at is equal to starts_at', async () => {
    const dto = toDto({
      title: 'Missão Relâmpago',
      starts_at: '2026-11-03T13:00:00.000Z',
      ends_at: '2026-11-03T13:00:00.000Z',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(1);
    expect(errors[0]?.property).toBe('ends_at');
    expect(Object.values(errors[0]?.constraints ?? {})[0]).toBe(
      'O horário de término deve ser posterior ao horário de início.',
    );
  });

  it('should reject when ends_at is earlier than starts_at', async () => {
    const dto = toDto({
      title: 'Missão no Passado',
      starts_at: '2026-11-03T15:00:00.000Z',
      ends_at: '2026-11-03T13:00:00.000Z',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(1);
    expect(errors[0]?.property).toBe('ends_at');
    expect(Object.values(errors[0]?.constraints ?? {})[0]).toBe(
      'O horário de término deve ser posterior ao horário de início.',
    );
  });
});
