import type {
  HeroImportJobEntity,
  ImportRowError,
} from '../entities/hero-import-job.entity.js';

export const IMPORT_REPOSITORY_TOKEN = Symbol('IImportRepository');

export interface ImportProgressUpdate {
  readonly processed_rows: number;
  readonly imported_count: number;
  readonly duplicate_count: number;
  readonly error_count: number;
  readonly errors: readonly ImportRowError[];
}

export interface IImportRepository {
  create(filename: string, totalRows: number): Promise<HeroImportJobEntity>;
  findById(id: string): Promise<HeroImportJobEntity | null>;
  listRecent(limit?: number): Promise<readonly HeroImportJobEntity[]>;
  updateProgress(id: string, progress: ImportProgressUpdate): Promise<void>;
  complete(id: string, progress: ImportProgressUpdate): Promise<void>;
  fail(id: string, reason: string): Promise<void>;
}
