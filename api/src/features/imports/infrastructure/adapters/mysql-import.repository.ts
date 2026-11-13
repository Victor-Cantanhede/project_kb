import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { MysqlDatabaseService } from '../../../../core/database/mysql-database.service.js';
import {
  HeroImportJobEntity,
  type ImportJobStatus,
} from '../../domain/entities/hero-import-job.entity.js';
import type {
  IImportRepository,
  ImportProgressUpdate,
} from '../../domain/ports/import-repository.port.js';

const IMPORT_STATUSES = ['processing', 'completed', 'failed'] as const;

const rowErrorSchema = z.object({
  line: z.coerce.number(),
  message: z.string(),
});

const errorsColumnSchema = z.preprocess((val) => {
  if (val === null || val === undefined) return [];
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  }
  return val;
}, z.array(rowErrorSchema));

const importJobRowSchema = z.object({
  id: z.string(),
  filename: z.string(),
  status: z.enum(IMPORT_STATUSES),
  total_rows: z.coerce.number(),
  processed_rows: z.coerce.number(),
  imported_count: z.coerce.number(),
  duplicate_count: z.coerce.number(),
  error_count: z.coerce.number(),
  errors: errorsColumnSchema,
  failure_reason: z.string().nullable(),
  created_at: z.union([z.date(), z.string()]).transform((val) => new Date(val)),
  updated_at: z.union([z.date(), z.string()]).transform((val) => new Date(val)),
});

const IMPORT_COLUMNS = `
  id, filename, status, total_rows, processed_rows,
  imported_count, duplicate_count, error_count, errors, failure_reason,
  created_at, updated_at
`;

@Injectable()
export class MysqlImportRepository implements IImportRepository {
  constructor(
    @Inject(MysqlDatabaseService)
    private readonly db: MysqlDatabaseService,
  ) {}

  async create(filename: string, totalRows: number): Promise<HeroImportJobEntity> {
    const id = randomUUID();
    const now = new Date();
    await this.db.execute(
      this.db.getPool(),
      `INSERT INTO hero_imports (
        id, filename, status, total_rows, processed_rows,
        imported_count, duplicate_count, error_count, errors, failure_reason,
        created_at, updated_at
      ) VALUES (?, ?, 'processing', ?, 0, 0, 0, 0, ?, NULL, ?, ?)`,
      [id, filename, totalRows, JSON.stringify([]), now, now],
    );
    return new HeroImportJobEntity({
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
    });
  }

  async findById(id: string): Promise<HeroImportJobEntity | null> {
    const rows = await this.db.selectRows(
      this.db.getPool(),
      importJobRowSchema,
      `SELECT ${IMPORT_COLUMNS} FROM hero_imports WHERE id = ?`,
      [id],
    );
    const row = rows[0];
    return row ? new HeroImportJobEntity(row) : null;
  }

  async listRecent(limit = 20): Promise<readonly HeroImportJobEntity[]> {
    const rows = await this.db.selectRows(
      this.db.getPool(),
      importJobRowSchema,
      `SELECT ${IMPORT_COLUMNS} FROM hero_imports ORDER BY created_at DESC, id DESC LIMIT ?`,
      [limit],
    );
    return rows.map((row) => new HeroImportJobEntity(row));
  }

  async updateProgress(id: string, progress: ImportProgressUpdate): Promise<void> {
    await this.db.execute(
      this.db.getPool(),
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

  async complete(id: string, progress: ImportProgressUpdate): Promise<void> {
    await this.db.execute(
      this.db.getPool(),
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

  async fail(id: string, reason: string): Promise<void> {
    await this.db.execute(
      this.db.getPool(),
      `UPDATE hero_imports SET status = 'failed', failure_reason = ?, updated_at = ? WHERE id = ?`,
      [reason, new Date(), id],
    );
  }
}
