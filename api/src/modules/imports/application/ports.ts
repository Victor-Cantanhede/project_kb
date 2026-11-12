import type { HeroCreateInput } from '../../heroes/index.js';
import type { HeroImportJob, ImportJobId, ImportRowError } from '../domain/csv-import.js';

export interface ImportProgressUpdate {
  readonly processed_rows: number;
  readonly imported_count: number;
  readonly duplicate_count: number;
  readonly error_count: number;
  readonly errors: readonly ImportRowError[];
}

export interface ImportRepository {
  create(filename: string, totalRows: number): Promise<HeroImportJob>;
  findById(id: ImportJobId): Promise<HeroImportJob | null>;
  listRecent(limit: number): Promise<readonly HeroImportJob[]>;
  updateProgress(id: ImportJobId, progress: ImportProgressUpdate): Promise<void>;
  complete(id: ImportJobId, progress: ImportProgressUpdate): Promise<void>;
  fail(id: ImportJobId, reason: string): Promise<void>;
}

export interface HeroBatchInserterPort {
  insertBatch(inputs: readonly HeroCreateInput[]): Promise<number>;
}

