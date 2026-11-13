import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../src/core/errors/domain.exception.js';
import { decodeCursor, encodeCursor, toPage } from '../src/core/pagination/keyset-pagination.js';
import { createValidationPipe } from '../src/core/security/validation-pipe.factory.js';
import {
  CreateHeroDto,
  CreateHeroUseCase,
  diffHero,
  HERO_LIMITS,
  HeroEntity,
  type IHeroRepository,
  isCalendarDay,
  todayIn,
  UpdateHeroDto,
} from '../src/features/heroes/index.js';
import {
  assertCanCancel,
  assertCanFinish,
  assertCanModifyRoster,
  assertCanStart,
  doPeriodsOverlap,
} from '../src/features/missions/domain/utils/mission-schedule.util.js';
import { CreateMissionDto } from '../src/features/missions/infrastructure/dtos/create-mission.dto.js';
import {
  MAX_CSV_ROWS,
  validateAndExtractCsvRows,
  validateCsvRow,
} from '../src/features/imports/domain/utils/csv-parser.util.js';
import { detectImageMimeType, MAX_AVATAR_BYTES } from '../src/features/avatars/index.js';
import { assertSafeTestDatabase } from './circuit-breaker.js';

const pipe = createValidationPipe();

async function validateDto<T extends object>(
  metatype: new () => T,
  payload: Record<string, unknown>,
): Promise<T> {
  return (await pipe.transform(payload, {
    type: 'body',
    metatype,
  })) as T;
}

describe('Unit Suite — Domain Rules, Boundary Values & Security Invariants', () => {
  describe('Block 1: Happy Path Specifications', () => {
    it('should validate and trim a legitimate hero creation payload', async () => {
      const rawPayload = {
        name: '  Robert Bruce Banner  ',
        nickname: '  Hulk ',
        date_of_birth: '1962-04-10',
        universe: ' Marvel ',
        main_power: ' Força ',
        avatar_url: 'https://exemplo.com/hulk.jpg',
      };

      const parsed = await validateDto(CreateHeroDto, rawPayload);

      expect(parsed).toMatchObject({
        name: 'Robert Bruce Banner',
        nickname: 'Hulk',
        date_of_birth: '1962-04-10',
        universe: 'Marvel',
        main_power: 'Força',
        avatar_url: 'https://exemplo.com/hulk.jpg',
      });
    });

    it('should compute exact field diffs when editing a hero', () => {
      const existingHero = new HeroEntity({
        id: 'e314636e-1ca6-4925-a0e7-da5eb5ae2403',
        name: 'Robert Bruce Banner',
        nickname: 'Hulk',
        date_of_birth: '1962-04-10',
        universe: 'Marvel',
        main_power: 'Força',
        avatar_url: null,
        is_active: true,
        version: 1,
        created_at: new Date('2024-09-18T21:41:43.120Z'),
        updated_at: new Date('2024-09-18T21:41:43.120Z'),
      });

      const changes = diffHero(existingHero, {
        nickname: 'Hulk Verde',
        universe: 'Marvel',
      });

      expect(changes).toEqual([
        {
          field: 'nickname',
          old_value: 'Hulk',
          new_value: 'Hulk Verde',
        },
      ]);
    });

    it('should allow adjacent mission periods where one ends at 12:00 and the next starts at 12:00', () => {
      const missionAStart = new Date('2026-11-03T10:00:00.000Z');
      const missionAEnd = new Date('2026-11-03T12:00:00.000Z');
      const missionBStart = new Date('2026-11-03T11:00:00.000Z');
      const missionBEnd = new Date('2026-11-03T13:00:00.000Z');
      const missionCStart = new Date('2026-11-03T12:00:00.000Z');
      const missionCEnd = new Date('2026-11-03T14:00:00.000Z');

      const overlapsB = doPeriodsOverlap(missionAStart, missionAEnd, missionBStart, missionBEnd);
      const overlapsC = doPeriodsOverlap(missionAStart, missionAEnd, missionCStart, missionCEnd);

      expect(overlapsB).toBe(true);
      expect(overlapsC).toBe(false);
    });

    it('should encode and decode keyset pagination cursors losslessly', () => {
      const rows = [
        { id: '003', at: new Date('2026-01-01T10:00:00.000Z') },
        { id: '002', at: new Date('2026-01-01T10:00:00.000Z') },
        { id: '001', at: new Date('2026-01-01T09:59:59.000Z') },
      ];

      const page = toPage(rows, 2, (row) => ({ at: row.at, id: row.id }));
      const decoded = page.next_cursor ? decodeCursor(page.next_cursor) : null;

      expect(page.data).toHaveLength(2);
      expect(decoded).toEqual({
        at: new Date('2026-01-01T10:00:00.000Z'),
        id: '002',
      });
    });

    it('should detect PNG, JPEG, WEBP, and GIF magic bytes accurately', () => {
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const webp = Buffer.from('RIFF\x00\x00\x00\x00WEBP', 'ascii');
      const gif = Buffer.from('GIF89a', 'ascii');

      expect(detectImageMimeType(png)).toBe('image/png');
      expect(detectImageMimeType(jpeg)).toBe('image/jpeg');
      expect(detectImageMimeType(webp)).toBe('image/webp');
      expect(detectImageMimeType(gif)).toBe('image/gif');
    });
  });

  describe('Block 2: Adverse & Boundary Edge Cases (BVA & State Machine)', () => {
    it('should reject whitespace-only strings and boundary-plus-one lengths on hero fields', async () => {
      const invalidPayload = {
        name: '   \t\n  ',
        nickname: 'A'.repeat(HERO_LIMITS.nickname + 1),
        date_of_birth: '1990-05-15',
        universe: 'Marvel',
        main_power: 'Voo',
      };

      try {
        await validateDto(CreateHeroDto, invalidPayload);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(DomainError);
        const fields = (err as DomainError).extra.fields?.map((f) => f.field) ?? [];
        expect(fields).toContain('name');
        expect(fields).toContain('nickname');
      }
    });

    it('should accept exact maximum field lengths and today as date_of_birth, but reject tomorrow', async () => {
      const today = todayIn('America/Sao_Paulo');
      const exactBoundary = {
        name: 'N'.repeat(HERO_LIMITS.name),
        nickname: 'K'.repeat(HERO_LIMITS.nickname),
        date_of_birth: today,
        universe: 'U'.repeat(HERO_LIMITS.universe),
        main_power: 'P'.repeat(HERO_LIMITS.main_power),
      };

      const validResult = await validateDto(CreateHeroDto, exactBoundary);
      expect(validResult.name).toHaveLength(HERO_LIMITS.name);

      const useCase = new CreateHeroUseCase({} as IHeroRepository);
      await expect(
        useCase.execute({ ...exactBoundary, date_of_birth: '2099-11-13' }),
      ).rejects.toBeInstanceOf(DomainError);
    });

    it('should reject impossible calendar dates like Feb 30 or month 13', () => {
      expect(isCalendarDay('2024-02-29')).toBe(true);
      expect(isCalendarDay('2025-02-29')).toBe(false);
      expect(isCalendarDay('2026-02-30')).toBe(false);
      expect(isCalendarDay('2026-13-01')).toBe(false);
    });

    it('should resolve todayIn across timezones and fall back cleanly when given an invalid timezone', () => {
      const instant = new Date('2026-11-12T01:30:00.000Z');

      const dayInSaoPaulo = todayIn('America/Sao_Paulo', instant);
      const dayInUtc = todayIn('UTC', instant);
      const dayWithInvalidZone = todayIn('Invalid/Zone_Name', instant, 'UTC');

      expect(dayInSaoPaulo).toBe('2026-11-11');
      expect(dayInUtc).toBe('2026-11-12');
      expect(dayWithInvalidZone).toBe('2026-11-12');
    });

    it('should enforce mission state machine transitions and reject illegal transitions', () => {
      expect(() => assertCanStart('scheduled', 0)).toThrowError(DomainError);
      expect(() => assertCanStart('in_progress', 2)).toThrowError(DomainError);
      expect(() => assertCanFinish('scheduled')).toThrowError(DomainError);
      expect(() => assertCanFinish('succeeded')).toThrowError(DomainError);
      expect(() => assertCanCancel('succeeded')).toThrowError(DomainError);
      expect(() => assertCanCancel('failed')).toThrowError(DomainError);
      expect(() => assertCanCancel('cancelled')).toThrowError(DomainError);
      expect(() => assertCanModifyRoster('in_progress')).toThrowError(DomainError);
      expect(() => assertCanModifyRoster('succeeded')).toThrowError(DomainError);
    });

    it('should reject mission creation when ends_at is equal to or before starts_at', async () => {
      const sameTime = {
        title: 'Missão Relâmpago',
        starts_at: '2026-11-03T13:00:00.000Z',
        ends_at: '2026-11-03T13:00:00.000Z',
      };

      await expect(validateDto(CreateMissionDto, sameTime)).rejects.toBeInstanceOf(DomainError);
    });

    it('should reject CSV files with wrong header, 0 rows, or > 20,000 rows, while isolating single-row errors', () => {
      const header = 'name,nickname,date_of_birth,universe,main_power,avatar_url';
      const tooManyRows = `${header}\n${'Bruce,Hulk,1962-04-10,Marvel,Força,\n'.repeat(MAX_CSV_ROWS + 1)}`;

      expect(() => validateAndExtractCsvRows('wrong,header\n1,2')).toThrowError(DomainError);
      expect(() => validateAndExtractCsvRows(`${header}\n`)).toThrowError(DomainError);
      expect(() => validateAndExtractCsvRows(tooManyRows)).toThrowError(DomainError);

      const badRow = validateCsvRow(['Bruce', 'Hulk', '2099-01-01', 'Marvel', 'Força', ''], 18, '2026-11-12');
      expect(badRow.kind).toBe('invalid');
      if (badRow.kind === 'invalid') {
        expect(badRow.error.line).toBe(18);
        expect(badRow.error.message).toContain('futuro');
      }

      const withBlankLine = `${header}\nClark Kent,Superman,1938-04-18,DC,Voo,\n\nBruce Wayne,Batman,1939-03-30,DC,Inteligência,`;
      const extracted = validateAndExtractCsvRows(withBlankLine);
      expect(extracted.map((r) => r.line)).toEqual([2, 4]);
    });
  });

  describe('Block 3: Security & Adversarial Exploits (AppSec)', () => {
    it('should strip server-owned fields (mass assignment attempt of id, created_at, updated_at, is_active)', async () => {
      const maliciousPayload = {
        id: '00000000-0000-4000-8000-999999999999',
        name: 'Tony Stark',
        nickname: 'Homem de Ferro',
        date_of_birth: '1970-05-29',
        universe: 'Marvel',
        main_power: 'Tecnologia',
        is_active: false,
        created_at: '1999-01-01T00:00:00.000Z',
        updated_at: '1999-01-01T00:00:00.000Z',
        version: 1,
      };

      const created = await validateDto(CreateHeroDto, maliciousPayload);
      const patched = await validateDto(UpdateHeroDto, maliciousPayload);

      expect('id' in created).toBe(false);
      expect('created_at' in created).toBe(false);
      expect('updated_at' in created).toBe(false);
      expect('is_active' in created).toBe(false);
      expect('id' in patched).toBe(false);
      expect('created_at' in patched).toBe(false);
      expect('updated_at' in patched).toBe(false);
      expect('is_active' in patched).toBe(false);
    });

    it('should reject javascript: and data: URLs in avatar_url and reject null-byte injection in text fields', async () => {
      await expect(
        validateDto(CreateHeroDto, {
          name: 'Peter Parker',
          nickname: 'Homem-Aranha',
          date_of_birth: '2001-08-10',
          universe: 'Marvel',
          main_power: 'Sentido Aranha',
          avatar_url: 'javascript:alert(1)',
        }),
      ).rejects.toBeInstanceOf(DomainError);

      await expect(
        validateDto(CreateHeroDto, {
          name: 'Peter\u0000Parker',
          nickname: 'Homem-Aranha',
          date_of_birth: '2001-08-10',
          universe: 'Marvel',
          main_power: 'Sentido Aranha',
        }),
      ).rejects.toBeInstanceOf(DomainError);
    });

    it('should reject disguised SVG/HTML files and oversized payloads in avatar upload', () => {
      const disguisedHtml = Buffer.from('<script>alert("xss")</script>', 'utf8');
      const oversizedPng = Buffer.alloc(MAX_AVATAR_BYTES + 1, 0x89);

      expect(() => detectImageMimeType(disguisedHtml)).toThrowError(DomainError);
      try {
        detectImageMimeType(oversizedPng);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(DomainError);
        if (err instanceof DomainError) {
          expect(err.kind).toBe('payload_too_large');
          expect(err.code).toBe('FILE_TOO_LARGE');
        }
      }
    });

    it('should reject tampered pagination cursors with a 400 validation error', () => {
      const validCursor = encodeCursor({ at: new Date('2026-01-01T00:00:00.000Z'), id: 'abc' });
      const tamperedCursor = `${validCursor.slice(0, -4)}XXXX`;

      expect(() => decodeCursor(tamperedCursor)).toThrowError(DomainError);
      expect(() => decodeCursor('not-valid-base64-json')).toThrowError(DomainError);
    });

    it('should enforce the test database isolation circuit breaker against production or dev DB pollution', () => {
      expect(() =>
        assertSafeTestDatabase({
          NODE_ENV: 'production',
          DATABASE_URL: 'mysql://hero:hero@localhost:3307/hero_factory',
          DATABASE_URL_TEST: 'mysql://hero:hero@localhost:3307/hero_factory_test',
        }),
      ).toThrow(/PRODUÇÃO/);

      expect(() =>
        assertSafeTestDatabase({
          NODE_ENV: 'development',
          DATABASE_URL: 'mysql://hero:hero@localhost:3307/hero_factory',
        }),
      ).toThrow(/DATABASE_URL_TEST/);

      expect(() =>
        assertSafeTestDatabase({
          NODE_ENV: 'development',
          DATABASE_URL: 'mysql://hero:hero@localhost:3307/hero_factory',
          DATABASE_URL_TEST: 'mysql://hero:hero@localhost:3307/hero_factory',
        }),
      ).toThrow(/IDÊNTICA/);
    });
  });
});
