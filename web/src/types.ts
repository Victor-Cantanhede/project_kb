export type AsyncState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'success'; readonly data: T };

export function assertUnreachable(value: never): never {
  throw new Error(`Estado não tratado: ${JSON.stringify(value)}`);
}

export interface Hero {
  readonly id: string;
  readonly name: string;
  readonly nickname: string;
  readonly date_of_birth: string;
  readonly universe: string;
  readonly main_power: string;
  readonly avatar_url: string | null;
  readonly is_active: boolean;
  readonly version: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export type HistoryField =
  | 'name'
  | 'nickname'
  | 'date_of_birth'
  | 'universe'
  | 'main_power'
  | 'avatar_url'
  | 'is_active';

export interface HeroHistoryEntry {
  readonly id: string;
  readonly field: HistoryField;
  readonly old_value: string | null;
  readonly new_value: string | null;
  readonly changed_at: string;
}

export type MissionStatus = 'scheduled' | 'in_progress' | 'succeeded' | 'failed' | 'cancelled';
export type MissionOutcome = 'succeeded' | 'failed';

export interface MissionHeroSummary {
  readonly id: string;
  readonly nickname: string;
}

export interface Mission {
  readonly id: string;
  readonly title: string;
  readonly starts_at: string;
  readonly ends_at: string;
  readonly status: MissionStatus;
  readonly heroes: readonly MissionHeroSummary[];
}

export interface ImportRowError {
  readonly line: number;
  readonly message: string;
}

export interface HeroImportJob {
  readonly id: string;
  readonly filename: string;
  readonly status: 'processing' | 'completed' | 'failed';
  readonly total_rows: number;
  readonly processed_rows: number;
  readonly imported_count: number;
  readonly duplicate_count: number;
  readonly error_count: number;
  readonly errors: readonly ImportRowError[];
  readonly failure_reason: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface Page<T> {
  readonly data: readonly T[];
  readonly next_cursor: string | null;
}

export function updateCursorTrail(
  prev: readonly (string | null)[],
  pageIdx: number,
  nextCursor: string | null,
): readonly (string | null)[] {
  if (!nextCursor) return prev.length > pageIdx + 1 ? prev.slice(0, pageIdx + 1) : prev;
  if (prev[pageIdx + 1] === nextCursor) return prev;
  return [...prev.slice(0, pageIdx + 1), nextCursor];
}

export interface FieldError {
  readonly field: string;
  readonly message: string;
}

export class ApiClientError extends Error {
  override readonly name = 'ApiClientError';

  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly fields: readonly FieldError[] = [],
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
  }
}

