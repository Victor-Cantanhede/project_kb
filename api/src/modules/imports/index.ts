import type { Pool } from 'mysql2/promise';
import { ImportService } from './application/import-service.js';
import type { HeroBatchInserterPort } from './application/ports.js';
import { MysqlImportRepository } from './infrastructure/mysql-import-repository.js';

export {
  EXPECTED_CSV_HEADER,
  IMPORT_STATUSES,
  MAX_CSV_ROWS,
  toImportJobId,
  validateAndExtractCsvRows,
  validateCsvRow,
  type CsvDataRow,
  type HeroImportJob,
  type ImportJobId,
  type ImportRowError,
  type ImportStatus,
  type ParsedCsvRow,
} from './domain/csv-import.js';
export { ImportService } from './application/import-service.js';
export type { HeroBatchInserterPort, ImportProgressUpdate, ImportRepository } from './application/ports.js';
export { registerImportRoutes } from './infrastructure/http.js';

export function createImportsModule(pool: Pool, heroInserter: HeroBatchInserterPort): ImportService {
  const repo = new MysqlImportRepository(pool);
  return new ImportService(repo, heroInserter);
}

