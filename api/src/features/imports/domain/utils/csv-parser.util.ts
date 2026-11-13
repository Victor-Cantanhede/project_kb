import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { DomainError, validationError } from '../../../../core/errors/domain.exception.js';
import { isCalendarDay, isValidAvatarUrl, type HeroBatchInsertInput } from '../../../heroes/index.js';
import type { ImportRowError } from '../entities/hero-import-job.entity.js';

export const MAX_CSV_ROWS = 20_000;
export const EXPECTED_CSV_HEADER = [
  'name',
  'nickname',
  'date_of_birth',
  'universe',
  'main_power',
  'avatar_url',
] as const;

export const MIN_DATE_OF_BIRTH = '1000-01-01';

export interface CsvDataRow {
  readonly line: number;
  readonly columns: readonly string[];
}

export type ParsedCsvRow =
  | { readonly kind: 'valid'; readonly line: number; readonly input: HeroBatchInsertInput }
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
    throw validationError([
      { field: 'file', message: 'Não foi possível ler o arquivo CSV. Verifique a formatação.' },
    ]);
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
    throw validationError([
      { field: 'file', message: 'O arquivo CSV não contém heróis para importar.' },
    ]);
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

// Control characters pattern
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const requiredText = (label: string, max: number) =>
  z
    .string({ error: `Informe ${label}.` })
    .trim()
    .min(1, { error: `Informe ${label}.` })
    .max(max, { error: `Use no máximo ${max} caracteres.` })
    .refine((value) => !CONTROL_CHARS.test(value), { error: 'Contém caracteres inválidos.' });

const dateOfBirth = (today: string) =>
  z
    .string({ error: 'Informe a data de nascimento.' })
    .trim()
    .refine(isCalendarDay, { error: 'Use uma data válida no formato AAAA-MM-DD.' })
    .refine((day) => day >= MIN_DATE_OF_BIRTH, {
      error: 'A data de nascimento deve ser a partir do ano 1000.',
    })
    .refine((day) => day <= today, { error: 'A data de nascimento não pode ser no futuro.' });

const avatarUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .string({ error: 'Informe uma URL de imagem.' })
    .trim()
    .max(2048, { error: 'Use no máximo 2048 caracteres.' })
    .refine((url) => isValidAvatarUrl(url), { error: 'Informe uma URL http(s) válida.' })
    .nullable(),
);

const buildRowSchema = (today: string) =>
  z.object({
    name: requiredText('o nome completo', 120),
    nickname: requiredText('o nome de guerra', 60),
    date_of_birth: dateOfBirth(today),
    universe: requiredText('o universo', 60),
    main_power: requiredText('a habilidade', 60),
    avatar_url: avatarUrl.optional().transform((value) => value ?? null),
  });

export function validateCsvRow(
  row: readonly string[],
  line: number,
  today: string,
): ParsedCsvRow {
  if (row.length !== EXPECTED_CSV_HEADER.length) {
    return {
      kind: 'invalid',
      error: { line, message: `Esperadas 6 colunas, mas foram encontradas ${row.length}.` },
    };
  }

  const schema = buildRowSchema(today);
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

  const message = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  return { kind: 'invalid', error: { line, message } };
}
