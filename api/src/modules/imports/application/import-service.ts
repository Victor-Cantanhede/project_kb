import { z } from 'zod';
import { DomainError } from '../../../shared/kernel/errors.js';
import { parseInput } from '../../../shared/kernel/validation.js';
import { todayIn, type HeroCreateInput } from '../../heroes/index.js';
import {
  toImportJobId,
  validateAndExtractCsvRows,
  validateCsvRow,
  type CsvDataRow,
  type HeroImportJob,
  type ImportJobId,
  type ImportRowError,
} from '../domain/csv-import.js';
import type { HeroBatchInserterPort, ImportRepository } from './ports.js';

const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';
const CHUNK_SIZE = 500;

const importIdSchema = z.uuid({ error: 'Identificador de importação inválido.' }).transform(toImportJobId);

export class ImportService {
  private readonly activeJobs = new Set<Promise<void>>();

  constructor(
    private readonly repo: ImportRepository,
    private readonly heroInserter: HeroBatchInserterPort,
  ) {}

  async startImport(filename: string, csvContent: string, timeZone?: string): Promise<HeroImportJob> {
    const safeFilename = filename.trim().slice(0, 255) || 'herois.csv';
    const dataRows = validateAndExtractCsvRows(csvContent);
    const today = todayIn(timeZone ?? DEFAULT_TIME_ZONE, new Date(), DEFAULT_TIME_ZONE);
    const job = await this.repo.create(safeFilename, dataRows.length);

    const task = this.runImportJob(job.id, dataRows, today).finally(() => {
      this.activeJobs.delete(task);
    });
    this.activeJobs.add(task);

    return job;
  }

  async getById(rawId: unknown): Promise<HeroImportJob> {
    const { id } = parseInput(z.object({ id: importIdSchema }), { id: rawId });
    const job = await this.repo.findById(id);
    if (!job) throw new DomainError('not_found', 'IMPORT_NOT_FOUND', 'Importação não encontrada.');
    return job;
  }

  async listRecent(): Promise<readonly HeroImportJob[]> {
    return this.repo.listRecent(20);
  }

  async waitForAll(): Promise<void> {
    await Promise.allSettled(Array.from(this.activeJobs));
  }

  private async runImportJob(
    jobId: ImportJobId,
    dataRows: readonly CsvDataRow[],
    today: string,
  ): Promise<void> {
    let processed = 0;
    let imported = 0;
    let duplicates = 0;
    const errors: ImportRowError[] = [];

    try {
      for (let offset = 0; offset < dataRows.length; offset += CHUNK_SIZE) {
        await new Promise<void>((resolve) => setImmediate(resolve));
        const chunk = dataRows.slice(offset, offset + CHUNK_SIZE);
        const validInputs: HeroCreateInput[] = [];

        for (const row of chunk) {
          const validated = validateCsvRow(row.columns, row.line, today);
          if (validated.kind === 'valid') {
            validInputs.push(validated.input);
          } else {
            errors.push(validated.error);
          }
        }

        const newlyInserted = await this.heroInserter.insertBatch(validInputs);
        imported += newlyInserted;
        duplicates += validInputs.length - newlyInserted;
        processed += chunk.length;

        await this.repo.updateProgress(jobId, {
          processed_rows: processed,
          imported_count: imported,
          duplicate_count: duplicates,
          error_count: errors.length,
          errors,
        });
      }

      await this.repo.complete(jobId, {
        processed_rows: processed,
        imported_count: imported,
        duplicate_count: duplicates,
        error_count: errors.length,
        errors,
      });
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message.slice(0, 250) : 'Falha inesperada ao processar CSV.';
      await this.repo.fail(jobId, reason);
    }
  }
}

