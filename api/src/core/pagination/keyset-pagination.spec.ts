import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors/domain.exception.js';
import {
  type CursorPosition,
  decodeCursor,
  encodeCursor,
  toPage,
} from './keyset-pagination.js';

describe('KeysetPagination (Unit Test)', () => {
  it('deve codificar e decodificar cursor com timestamp ISO e ID', () => {
    const original: CursorPosition = {
      at: new Date('2026-03-15T12:00:00.000Z'),
      id: 'hero-uuid-1234',
    };

    const encoded = encodeCursor(original);
    expect(typeof encoded).toBe('string');
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');

    const decoded = decodeCursor(encoded);
    expect(decoded.at.toISOString()).toBe(original.at.toISOString());
    expect(decoded.id).toBe(original.id);
  });

  it('deve rejeitar cursores malformados com DomainError VALIDATION_ERROR no campo cursor', () => {
    const invalidCursors = [
      'not-a-valid-base64url!!!',
      Buffer.from('not-json').toString('base64url'),
      Buffer.from(JSON.stringify({ not: 'an-array' })).toString('base64url'),
      Buffer.from(JSON.stringify(['2026-03-15T12:00:00.000Z'])).toString('base64url'), // missing id
      Buffer.from(JSON.stringify(['not-a-date', 'hero-123'])).toString('base64url'),
      Buffer.from(JSON.stringify(['2026-03-15T12:00:00.000Z', ''])).toString('base64url'), // empty id
      Buffer.from(JSON.stringify(['2026-03-15T12:00:00.000Z', 'a'.repeat(65)])).toString('base64url'), // id too long
    ];

    for (const invalid of invalidCursors) {
      expect(() => decodeCursor(invalid)).toThrowError(DomainError);
      try {
        decodeCursor(invalid);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(DomainError);
        const domainErr = err as DomainError;
        expect(domainErr.kind).toBe('validation');
        expect(domainErr.code).toBe('VALIDATION_ERROR');
        expect(domainErr.extra.fields).toEqual([{ field: 'cursor', message: 'Cursor de paginação inválido.' }]);
      }
    }
  });

  it('deve montar página com next_cursor nulo quando rows <= limit', () => {
    const rows = [
      { id: '1', name: 'Hero 1', createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { id: '2', name: 'Hero 2', createdAt: new Date('2026-01-02T00:00:00.000Z') },
    ];

    // Empty rows
    const emptyPage = toPage<{ id: string; createdAt: Date }>([], 2, (r) => ({ at: r.createdAt, id: r.id }));
    expect(emptyPage.data).toEqual([]);
    expect(emptyPage.next_cursor).toBeNull();

    // Exactly limit
    const exactPage = toPage(rows, 2, (r) => ({ at: r.createdAt, id: r.id }));
    expect(exactPage.data).toHaveLength(2);
    expect(exactPage.next_cursor).toBeNull();

    // Less than limit
    const lessPage = toPage(rows, 5, (r) => ({ at: r.createdAt, id: r.id }));
    expect(lessPage.data).toHaveLength(2);
    expect(lessPage.next_cursor).toBeNull();
  });

  it('deve fatiar rows para limit e gerar next_cursor do último item quando rows > limit', () => {
    const rows = [
      { id: 'h-1', name: 'Hero 1', createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { id: 'h-2', name: 'Hero 2', createdAt: new Date('2026-01-02T00:00:00.000Z') },
      { id: 'h-3', name: 'Hero 3', createdAt: new Date('2026-01-03T00:00:00.000Z') },
    ];

    const limit = 2;
    const page = toPage(rows, limit, (r) => ({ at: r.createdAt, id: r.id }));

    expect(page.data).toHaveLength(2);
    expect(page.data[0]?.id).toBe('h-1');
    expect(page.data[1]?.id).toBe('h-2');
    expect(page.next_cursor).toBeDefined();

    const decoded = decodeCursor(page.next_cursor!);
    expect(decoded.id).toBe('h-2');
    expect(decoded.at.toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });

  it('deve manter desempate determinístico por ID quando timestamps forem idênticos', () => {
    const tiedTimestamp = new Date('2026-02-01T10:00:00.000Z');
    const heroA = { id: 'uuid-b', createdAt: tiedTimestamp };
    const heroB = { id: 'uuid-a', createdAt: tiedTimestamp };
    const extra = { id: 'uuid-0', createdAt: tiedTimestamp };

    const page = toPage([heroA, heroB, extra], 2, (r) => ({ at: r.createdAt, id: r.id }));
    expect(page.data).toHaveLength(2);
    expect(page.next_cursor).toBeDefined();

    const decoded = decodeCursor(page.next_cursor!);
    expect(decoded.id).toBe('uuid-a');
    expect(decoded.at.toISOString()).toBe(tiedTimestamp.toISOString());
  });
});
