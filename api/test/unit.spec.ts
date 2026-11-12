import { describe, expect, it } from 'vitest';
import { DomainError } from '../src/shared/kernel/errors.js';
import { decodeCursor, encodeCursor, toPage } from '../src/shared/kernel/pagination.js';
import { parseInput } from '../src/shared/kernel/validation.js';
import {
  buildHeroCreateSchema,
  buildHeroPatchSchema,
  diffHero,
  HERO_LIMITS,
  isCalendarDay,
  todayIn,
  toHeroId,
  type Hero,
} from '../src/modules/heroes/index.js';
import {
  assertCanCancel,
  assertCanFinish,
  assertCanModifyRoster,
  assertCanStart,
  doPeriodsOverlap,
  missionCreateSchema,
} from '../src/modules/missions/index.js';
import {
  MAX_CSV_ROWS,
  validateAndExtractCsvRows,
  validateCsvRow,
} from '../src/modules/imports/index.js';
import { detectImageMimeType, MAX_AVATAR_BYTES } from '../src/modules/avatars/index.js';
import { assertSafeTestDatabase } from './circuit-breaker.js';

describe('Unit Suite — Domain Rules, Boundary Values & Security Invariants', () => {
  describe('Block 1: Happy Path Specifications', () => {
    it('should validate and trim a legitimate hero creation payload', () => {
      // Arrange
      const schema = buildHeroCreateSchema('2026-11-12');
      const rawPayload = {
        name: '  Robert Bruce Banner  ',
        nickname: '  Hulk ',
        date_of_birth: '1962-04-10',
        universe: ' Marvel ',
        main_power: ' Força ',
        avatar_url: 'https://exemplo.com/hulk.jpg',
      };

      // Act
      const parsed = parseInput(schema, rawPayload);

      // Assert
      expect(parsed).toEqual({
        name: 'Robert Bruce Banner',
        nickname: 'Hulk',
        date_of_birth: '1962-04-10',
        universe: 'Marvel',
        main_power: 'Força',
        avatar_url: 'https://exemplo.com/hulk.jpg',
      });
    });

    it('should compute exact field diffs when editing a hero', () => {
      // Arrange
      const existingHero: Hero = {
        id: toHeroId('e314636e-1ca6-4925-a0e7-da5eb5ae2403'),
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
      };

      // Act
      const changes = diffHero(existingHero, {
        nickname: 'Hulk Verde',
        universe: 'Marvel',
        version: 1,
      });

      // Assert
      expect(changes).toEqual([
        {
          field: 'nickname',
          old_value: 'Hulk',
          new_value: 'Hulk Verde',
        },
      ]);
    });

    it('should allow adjacent mission periods where one ends at 12:00 and the next starts at 12:00', () => {
      // Arrange
      const missionAStart = new Date('2026-11-03T10:00:00.000Z');
      const missionAEnd = new Date('2026-11-03T12:00:00.000Z');
      const missionBStart = new Date('2026-11-03T11:00:00.000Z');
      const missionBEnd = new Date('2026-11-03T13:00:00.000Z');
      const missionCStart = new Date('2026-11-03T12:00:00.000Z');
      const missionCEnd = new Date('2026-11-03T14:00:00.000Z');

      // Act
      const overlapsB = doPeriodsOverlap(missionAStart, missionAEnd, missionBStart, missionBEnd);
      const overlapsC = doPeriodsOverlap(missionAStart, missionAEnd, missionCStart, missionCEnd);

      // Assert
      expect(overlapsB).toBe(true);
      expect(overlapsC).toBe(false);
    });

    it('should encode and decode keyset pagination cursors losslessly', () => {
      // Arrange
      const rows = [
        { id: '003', at: new Date('2026-01-01T10:00:00.000Z') },
        { id: '002', at: new Date('2026-01-01T10:00:00.000Z') },
        { id: '001', at: new Date('2026-01-01T09:59:59.000Z') },
      ];

      // Act
      const page = toPage(rows, 2, (row) => ({ at: row.at, id: row.id }));
      const decoded = page.next_cursor ? decodeCursor(page.next_cursor) : null;

      // Assert
      expect(page.data).toHaveLength(2);
      expect(decoded).toEqual({
        at: new Date('2026-01-01T10:00:00.000Z'),
        id: '002',
      });
    });

    it('should detect PNG, JPEG, WEBP, and GIF magic bytes accurately', () => {
      // Arrange
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const webp = Buffer.from('RIFF\x00\x00\x00\x00WEBP', 'ascii');
      const gif = Buffer.from('GIF89a', 'ascii');

      // Act & Assert
      expect(detectImageMimeType(png)).toBe('image/png');
      expect(detectImageMimeType(jpeg)).toBe('image/jpeg');
      expect(detectImageMimeType(webp)).toBe('image/webp');
      expect(detectImageMimeType(gif)).toBe('image/gif');
    });
  });

  describe('Block 2: Adverse & Boundary Edge Cases (BVA & State Machine)', () => {
    it('should reject whitespace-only strings and boundary-plus-one lengths on hero fields', () => {
      // Arrange
      const schema = buildHeroCreateSchema('2026-11-12');
      const invalidPayload = {
        name: '   \t\n  ',
        nickname: 'A'.repeat(HERO_LIMITS.nickname + 1),
        date_of_birth: '1990-05-15',
        universe: 'Marvel',
        main_power: 'Voo',
      };

      // Act
      const result = schema.safeParse(invalidPayload);

      // Assert
      expect(result.success).toBe(false);
      const fields = result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
      expect(fields).toContain('name');
      expect(fields).toContain('nickname');
    });

    it('should accept exact maximum field lengths and today as date_of_birth, but reject tomorrow', () => {
      // Arrange
      const schema = buildHeroCreateSchema('2026-11-12');
      const exactBoundary = {
        name: 'N'.repeat(HERO_LIMITS.name),
        nickname: 'K'.repeat(HERO_LIMITS.nickname),
        date_of_birth: '2026-11-12',
        universe: 'U'.repeat(HERO_LIMITS.universe),
        main_power: 'P'.repeat(HERO_LIMITS.main_power),
      };

      // Act
      const validResult = schema.safeParse(exactBoundary);
      const futureResult = schema.safeParse({ ...exactBoundary, date_of_birth: '2026-11-13' });

      // Assert
      expect(validResult.success).toBe(true);
      expect(futureResult.success).toBe(false);
    });

    it('should reject impossible calendar dates like Feb 30 or month 13', () => {
      // Arrange & Act & Assert
      expect(isCalendarDay('2024-02-29')).toBe(true); // 2024 is a leap year
      expect(isCalendarDay('2025-02-29')).toBe(false);
      expect(isCalendarDay('2026-02-30')).toBe(false);
      expect(isCalendarDay('2026-13-01')).toBe(false);
    });

    it('should resolve todayIn across timezones and fall back cleanly when given an invalid timezone', () => {
      // Arrange
      const instant = new Date('2026-11-12T01:30:00.000Z'); // Still 2026-11-11 in America/Sao_Paulo (-03:00)

      // Act
      const dayInSaoPaulo = todayIn('America/Sao_Paulo', instant);
      const dayInUtc = todayIn('UTC', instant);
      const dayWithInvalidZone = todayIn('Invalid/Zone_Name', instant, 'UTC');

      // Assert
      expect(dayInSaoPaulo).toBe('2026-11-11');
      expect(dayInUtc).toBe('2026-11-12');
      expect(dayWithInvalidZone).toBe('2026-11-12');
    });

    it('should enforce mission state machine transitions and reject illegal transitions', () => {
      // Arrange & Act & Assert
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

    it('should reject mission creation when ends_at is equal to or before starts_at', () => {
      // Arrange
      const sameTime = {
        title: 'Missão Relâmpago',
        starts_at: '2026-11-03T13:00:00.000Z',
        ends_at: '2026-11-03T13:00:00.000Z',
      };

      // Act
      const result = missionCreateSchema.safeParse(sameTime);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should reject CSV files with wrong header, 0 rows, or > 20,000 rows, while isolating single-row errors', () => {
      // Arrange
      const header = 'name,nickname,date_of_birth,universe,main_power,avatar_url';
      const tooManyRows = `${header}\n${'Bruce,Hulk,1962-04-10,Marvel,Força,\n'.repeat(MAX_CSV_ROWS + 1)}`;

      // Act & Assert
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
    it('should strip server-owned fields (mass assignment attempt of id, created_at, updated_at, is_active)', () => {
      // Arrange
      const createSchema = buildHeroCreateSchema('2026-11-12');
      const patchSchema = buildHeroPatchSchema('2026-11-12');
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

      // Act
      const created = parseInput(createSchema, maliciousPayload);
      const patched = parseInput(patchSchema, maliciousPayload);

      // Assert
      expect('id' in created).toBe(false);
      expect('created_at' in created).toBe(false);
      expect('updated_at' in created).toBe(false);
      expect('is_active' in created).toBe(false);
      expect('id' in patched).toBe(false);
      expect('created_at' in patched).toBe(false);
      expect('updated_at' in patched).toBe(false);
      expect('is_active' in patched).toBe(false);
    });

    it('should reject javascript: and data: URLs in avatar_url and reject null-byte injection in text fields', () => {
      // Arrange
      const schema = buildHeroCreateSchema('2026-11-12');

      // Act
      const xssAttempt = schema.safeParse({
        name: 'Peter Parker',
        nickname: 'Homem-Aranha',
        date_of_birth: '2001-08-10',
        universe: 'Marvel',
        main_power: 'Sentido Aranha',
        avatar_url: 'javascript:alert(1)',
      });
      const nullByteAttempt = schema.safeParse({
        name: 'Peter\u0000Parker',
        nickname: 'Homem-Aranha',
        date_of_birth: '2001-08-10',
        universe: 'Marvel',
        main_power: 'Sentido Aranha',
      });

      // Assert
      expect(xssAttempt.success).toBe(false);
      expect(nullByteAttempt.success).toBe(false);
    });

    it('should reject disguised SVG/HTML files and oversized payloads in avatar upload', () => {
      // Arrange
      const disguisedHtml = Buffer.from('<script>alert("xss")</script>', 'utf8');
      const oversizedPng = Buffer.alloc(MAX_AVATAR_BYTES + 1, 0x89);

      // Act & Assert
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
      // Arrange
      const validCursor = encodeCursor({ at: new Date('2026-01-01T00:00:00.000Z'), id: 'abc' });
      const tamperedCursor = `${validCursor.slice(0, -4)}XXXX`;

      // Act & Assert
      expect(() => decodeCursor(tamperedCursor)).toThrowError(DomainError);
      expect(() => decodeCursor('not-valid-base64-json')).toThrowError(DomainError);
    });

    it('should enforce the test database isolation circuit breaker against production or dev DB pollution', () => {
      // Arrange & Act & Assert
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

