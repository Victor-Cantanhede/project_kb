import { getFriendlyErrorMessage } from './business-copy.js';

export interface FieldError {
  readonly field: string;
  readonly message: string;
}

export interface Page<T> {
  readonly data: readonly T[];
  readonly next_cursor: string | null;
}

export type AsyncState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'success'; readonly data: T };

export function assertUnreachable(value: never): never {
  throw new Error(`Estado não tratado: ${JSON.stringify(value)}`);
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

export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

export function extractFieldErrors(raw: unknown): readonly FieldError[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) =>
    isRecord(item) && typeof item.field === 'string' && typeof item.message === 'string'
      ? [{ field: item.field, message: item.message }]
      : [],
  );
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-Timezone', browserTimeZone());

  if (typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...init, headers });
  } catch {
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      getFriendlyErrorMessage('NETWORK_ERROR'),
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (isRecord(payload) && isRecord(payload.error)) {
      const errObj = payload.error;
      const code = typeof errObj.code === 'string' ? errObj.code : 'API_ERROR';
      const rawMessage = typeof errObj.message === 'string' ? errObj.message : null;
      const message = getFriendlyErrorMessage(
        code,
        rawMessage,
        `Erro ao processar requisição (HTTP ${response.status}).`,
      );
      const fields = extractFieldErrors(errObj.fields);
      const details = isRecord(errObj.details) ? errObj.details : {};
      throw new ApiClientError(response.status, code, message, fields, details);
    }

    throw new ApiClientError(
      response.status,
      'HTTP_ERROR',
      getFriendlyErrorMessage(
        'HTTP_ERROR',
        null,
        `O servidor respondeu com erro (${response.status}). Tente novamente.`,
      ),
    );
  }

  return payload as T;
}
