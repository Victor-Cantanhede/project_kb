import { z } from 'zod';
import { validationError } from '../errors/domain.exception.js';

/** Keyset position: (sort value, id). Sorting always ends on id, so ties never repeat or vanish. */
export interface CursorPosition {
  readonly at: Date;
  readonly id: string;
}

const isoDatetime =
  'iso' in z && typeof (z as unknown as { iso: { datetime: () => z.ZodType<string> } }).iso?.datetime === 'function'
    ? (z as unknown as { iso: { datetime: () => z.ZodType<string> } }).iso.datetime()
    : z.string().datetime();

const cursorSchema = z.tuple([isoDatetime, z.string().min(1).max(64)]);

export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(JSON.stringify([position.at.toISOString(), position.id])).toString('base64url');
}

export function decodeCursor(cursor: string): CursorPosition {
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    decoded = null; // malformed base64/JSON is just an invalid cursor, reported below
  }
  const parsed = cursorSchema.safeParse(decoded);
  if (!parsed.success) {
    throw validationError([{ field: 'cursor', message: 'Cursor de paginação inválido.' }]);
  }
  const [at, id] = parsed.data;
  return { at: new Date(at), id };
}

export interface Page<T> {
  readonly data: readonly T[];
  readonly next_cursor: string | null;
}

/** Repositories fetch `limit + 1` rows; the extra row only tells whether there is a next page. */
export function toPage<T>(rows: readonly T[], limit: number, positionOf: (row: T) => CursorPosition): Page<T> {
  const data = rows.slice(0, limit);
  const last = data.at(-1);
  return { data, next_cursor: rows.length > limit && last ? encodeCursor(positionOf(last)) : null };
}
