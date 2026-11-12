import { randomUUID } from 'node:crypto';
import type { Pool } from 'mysql2/promise';
import { z } from 'zod';
import { execute, selectRows } from '../../../shared/infra/db.js';
import {
  IMPORT_STATUSES,
  toImportJobId,
  type HeroImportJob,
  type ImportJobId,
} from '../domain/csv-import.js';
import type { ImportProgressUpdate, ImportRepository } from '../application/ports.js';

const rowErrorSchema = z.object({
  line: z.number(),
  message: z.string(),
});

const errorsColumnSchema = z.preprocess((val) => {
  if (val === null || val === undefined) return [];
  if (typeof val === 'string') {
    const parsed: unknown = JSON.parse(val);
    return parsed;
  }
  return val;
}, z.array(rowErrorSchema));

const importJobRowSchema = z.object({
  id: z.string().transform(toImportJobId),
  filename: z.string(),
  status: z.enum(IMPORT_STATUSES),
  total_rows: z.coerce.number(),
  processed_rows: z.coerce.number(),
  imported_count: z.coerce.number(),
  duplicate_count: z.coerce.number(),
  error_count: z.coerce.number(),
  errors: errorsColumnSchema,
  failure_reason: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

const IMPORT_COLUMNS = `
  id, filename, status, total_rows, processed_rows,
  imported_count, duplicate_count, error_count, errors, failure_reason,
  created_at, updated_at
`;

export class MysqlImportRepository implements ImportRepository {
  constructor(private readonly pool: Pool) {}

  async create(filename: string, totalRows: number): Promise<HeroImportJob> {
    const id = toImportJobId(randomUUID());
    const now = new Date();
    await execute(
      this.pool,
      `INSERT INTO hero_imports (
        id, filename, status, total_rows, processed_rows,
        imported_count, duplicate_count, error_count, errors, failure_reason,
        created_at, updated_at
      ) VALUES (?, ?, 'processing', ?, 0, 0, 0, 0, ?, NULL, ?, ?)`,
      [id, filename, totalRows, JSON.stringify([]), now, now],
    );
    return {
      id,
      filename,
      status: 'processing',
      total_rows: totalRows,
      processed_rows: 0,
      imported_count: 0,
      duplicate_count: 0,
      error_count: 0,
      errors: [],
      failure_reason: null,
      created_at: now,
      updated_at: now,
    };
  }

  async findById(id: ImportJobId): Promise<HeroImportJob | null> {
    const rows = await selectRows(
      this.pool,
      importJobRowSchema,
      `SELECT ${IMPORT_COLUMNS} FROM hero_imports WHERE id = ?`,
      [id],
    );
    return rows[0] ?? null;
  }

  async listRecent(limit: number): Promise<readonly HeroImportJob[]> {
    return selectRows(
      this.pool,
      importJobRowSchema,
      `SELECT ${IMPORT_COLUMNS} FROM hero_imports ORDER BY created_at DESC, id DESC LIMIT ?`,
      [limit],
    );
  }

  async updateProgress(id: ImportJobId, progress: ImportProgressUpdate): Promise<void> {
    await execute(
      this.pool,
      `UPDATE hero_imports
       SET processed_rows = ?, imported_count = ?, duplicate_count = ?,
           error_count = ?, errors = ?, updated_at = ?
       WHERE id = ?`,
      [
        progress.processed_rows,
        progress.imported_count,
        progress.duplicate_count,
        progress.error_count,
        JSON.stringify(progress.errors),
        new Date(),
        id,
      ],
    );
  }

  async complete(id: ImportJobId, progress: ImportProgressUpdate): Promise<void> {
    await execute(
      this.pool,
      `UPDATE hero_imports
       SET status = 'completed', processed_rows = ?, imported_count = ?,
           duplicate_count = ?, error_count = ?, errors = ?, updated_at = ?
       WHERE id = ?`,
      [
        progress.processed_rows,
        progress.imported_count,
        progress.duplicate_count,
        progress.error_count,
        JSON.stringify(progress.errors),
        new Date(),
        id,
      ],
    );
  }

  async fail(id: ImportJobId, reason: string): Promise<void> {
    await execute(
      this.pool,
      `UPDATE hero_imports SET status = 'failed', failure_reason = ?, updated_at = ? WHERE id = ?`,
      [reason, new Date(), id],
    );
  }
}
