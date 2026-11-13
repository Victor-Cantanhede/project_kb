export type ErrorKind = 'validation' | 'not_found' | 'conflict' | 'payload_too_large';

export interface FieldError {
  readonly field: string;
  readonly message: string;
}

export interface DomainErrorExtra {
  readonly fields?: readonly FieldError[];
  readonly details?: Readonly<Record<string, unknown>>;
}

function assertUnreachable(value: never): never {
  throw new Error(`Variante não tratada: ${String(value)}`);
}

export function statusFromKind(kind: ErrorKind): number {
  switch (kind) {
    case 'validation':
      return 400;
    case 'not_found':
      return 404;
    case 'conflict':
      return 409;
    case 'payload_too_large':
      return 413;
    default:
      return assertUnreachable(kind);
  }
}

/** Expected business failure. The HTTP layer maps `kind` to a status code. */
export class DomainError extends Error {
  override readonly name = 'DomainError';

  constructor(
    readonly kind: ErrorKind,
    readonly code: string,
    message: string,
    readonly extra: DomainErrorExtra = {},
  ) {
    super(message);
  }
}

export const validationError = (
  fields: readonly FieldError[],
  message = 'Alguns campos estão inválidos.',
): DomainError => new DomainError('validation', 'VALIDATION_ERROR', message, { fields });
