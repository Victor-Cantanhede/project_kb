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
