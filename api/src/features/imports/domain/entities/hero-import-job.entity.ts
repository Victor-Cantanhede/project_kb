export type ImportJobStatus = 'processing' | 'completed' | 'failed';

export interface ImportRowError {
  readonly line: number;
  readonly message: string;
}

export interface HeroImportJobProps {
  readonly id: string;
  readonly filename: string;
  readonly status: ImportJobStatus;
  readonly total_rows: number;
  readonly processed_rows: number;
  readonly imported_count: number;
  readonly duplicate_count: number;
  readonly error_count: number;
  readonly errors: readonly ImportRowError[];
  readonly failure_reason?: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

export class HeroImportJobEntity {
  readonly id: string;
  readonly filename: string;
  readonly status: ImportJobStatus;
  readonly total_rows: number;
  readonly processed_rows: number;
  readonly imported_count: number;
  readonly duplicate_count: number;
  readonly error_count: number;
  readonly errors: readonly ImportRowError[];
  readonly failure_reason: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;

  constructor(props: HeroImportJobProps) {
    this.id = props.id;
    this.filename = props.filename;
    this.status = props.status;
    this.total_rows = props.total_rows;
    this.processed_rows = props.processed_rows;
    this.imported_count = props.imported_count;
    this.duplicate_count = props.duplicate_count;
    this.error_count = props.error_count;
    this.errors = props.errors;
    this.failure_reason = props.failure_reason ?? null;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }

  static create(props: HeroImportJobProps): HeroImportJobEntity {
    return new HeroImportJobEntity(props);
  }
}
