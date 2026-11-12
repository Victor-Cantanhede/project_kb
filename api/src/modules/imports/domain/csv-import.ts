import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { DomainError, validationError } from '../../../shared/kernel/errors.js';
import type { Brand } from '../../../shared/kernel/types.js';
import { buildHeroCreateSchema, type HeroCreateInput } from '../../heroes/index.js';

export type ImportJobId = Brand<string, 'ImportJobId'>;
export const toImportJobId = (value: string): ImportJobId => value as ImportJobId;

export const MAX_CSV_ROWS = 20_000;
export const EXPECTED_CSV_HEADER = ['name', 'nickname', 'date_of_birth', 'universe', 'main_power', 'avatar_url'] as const;

export const IMPORT_STATUSES = ['processing', 'completed', 'failed'] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export interface ImportRowError {
  readonly line: number;
  readonly message: string;
}

export interface HeroImportJob {
  readonly id: ImportJobId;
  readonly filename: string;
  readonly status: ImportStatus;
  readonly total_rows: number;
  readonly processed_rows: number;
  readonly imported_count: number;
  readonly duplicate_count: number;
  readonly error_count: number;
  readonly errors: readonly ImportRowError[];
  readonly failure_reason: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

export interface CsvDataRow {
  readonly line: number;
  readonly columns: readonly string[];
}

export type ParsedCsvRow =
  | { readonly kind: 'valid'; readonly line: number; readonly input: HeroCreateInput }
  | { readonly kind: 'invalid'; readonly error: ImportRowError };

const rawRecordsSchema = z.array(
  z.object({
    record: z.array(z.string()),
    info: z.object({ lines: z.number().int().positive() }),
  }),
);

function parseRawRecords(csvContent: string): CsvDataRow[] {
  const cleaned = csvContent.replace(/^\uFEFF/, '');
  try {
    const raw: unknown = parse(cleaned, {
      bom: true,
      relax_column_count: true,
      skip_empty_lines: true,
      info: true,
    });
    return rawRecordsSchema.parse(raw).map((entry) => ({
      line: entry.info.lines,
      columns: entry.record,
    }));
  } catch {
    throw validationError([{ field: 'file', message: 'Não foi possível ler o arquivo CSV. Verifique a formatação.' }]);
  }
}

export function validateAndExtractCsvRows(csvContent: string): readonly CsvDataRow[] {
  const records = parseRawRecords(csvContent);
  const header = records[0];
  if (!header) {
    throw validationError([{ field: 'file', message: 'O arquivo CSV está vazio.' }]);
  }
  const normalizedHeader = header.columns.map((col) => col.trim());
  const isHeaderValid =
    normalizedHeader.length === EXPECTED_CSV_HEADER.length &&
    EXPECTED_CSV_HEADER.every((col, idx) => normalizedHeader[idx] === col);

  if (!isHeaderValid) {
    throw validationError([
      {
        field: 'file',
        message: `O cabeçalho do CSV deve ser exatamente: ${EXPECTED_CSV_HEADER.join(',')}`,
      },
    ]);
  }

  const dataRows = records.slice(1);
  if (dataRows.length === 0) {
    throw validationError([{ field: 'file', message: 'O arquivo CSV não contém heróis para importar.' }]);
  }
  if (dataRows.length > MAX_CSV_ROWS) {
    throw new DomainError(
      'validation',
      'CSV_ROW_LIMIT_EXCEEDED',
      `O arquivo CSV possui ${dataRows.length} linhas, mas o limite máximo é de ${MAX_CSV_ROWS}.`,
      { fields: [{ field: 'file', message: `Máximo de ${MAX_CSV_ROWS} heróis por arquivo.` }] },
    );
  }
  return dataRows;
}

export function validateCsvRow(row: readonly string[], line: number, today: string): ParsedCsvRow {
  if (row.length !== EXPECTED_CSV_HEADER.length) {
    return {
      kind: 'invalid',
      error: { line, message: `Esperadas 6 colunas, mas foram encontradas ${row.length}.` },
    };
  }
  const schema = buildHeroCreateSchema(today);
  const parsed = schema.safeParse({
    name: row[0],
    nickname: row[1],
    date_of_birth: row[2],
    universe: row[3],
    main_power: row[4],
    avatar_url: row[5],
  });
  if (parsed.success) {
    return { kind: 'valid', line, input: parsed.data };
  }
  const message = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  return { kind: 'invalid', error: { line, message } };
}
