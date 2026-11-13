import { Inject, Injectable } from '@nestjs/common';
import {
  HeroFacadeService,
  todayIn,
  type HeroBatchInsertInput,
} from '../../../heroes/index.js';
import type {
  HeroImportJobEntity,
  ImportRowError,
} from '../../domain/entities/hero-import-job.entity.js';
import {
  IMPORT_REPOSITORY_TOKEN,
  type IImportRepository,
} from '../../domain/ports/import-repository.port.js';
import {
  validateAndExtractCsvRows,
  validateCsvRow,
  type CsvDataRow,
} from '../../domain/utils/csv-parser.util.js';

const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';
const CHUNK_SIZE = 500;

@Injectable()
export class StartCsvImportUseCase {
  private readonly activeJobs = new Set<Promise<void>>();

  constructor(
    @Inject(IMPORT_REPOSITORY_TOKEN)
    private readonly repo: IImportRepository,
    @Inject(HeroFacadeService)
    private readonly heroFacade: HeroFacadeService,
  ) {}

  async execute(
    filename: string,
    csvContent: string,
    timeZone?: string,
  ): Promise<HeroImportJobEntity> {
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

  async waitForAll(): Promise<void> {
    await Promise.allSettled(Array.from(this.activeJobs));
  }

  private async runImportJob(
    jobId: string,
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
        const validInputs: HeroBatchInsertInput[] = [];

        for (const row of chunk) {
          const validated = validateCsvRow(row.columns, row.line, today);
          if (validated.kind === 'valid') {
            validInputs.push(validated.input);
          } else {
            errors.push(validated.error);
          }
        }

        const newlyInserted = await this.heroFacade.insertBatch(validInputs);
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
      const reason =
        error instanceof Error ? error.message.slice(0, 250) : 'Falha inesperada ao processar CSV.';
      await this.repo.fail(jobId, reason);
    }
  }
}
