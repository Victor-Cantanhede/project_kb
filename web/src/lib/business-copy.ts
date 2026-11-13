export const ERROR_CODE_TRANSLATIONS: Readonly<Record<string, string>> = {
  VALIDATION_ERROR: 'Alguns campos estão inválidos. Verifique os dados informados.',
  HERO_NOT_FOUND: 'Herói não encontrado.',
  MISSION_NOT_FOUND: 'Missão não encontrada.',
  AVATAR_NOT_FOUND: 'Avatar não encontrado.',
  DUPLICATE_HERO: 'Já existe um herói com este nome ou nome de guerra.',
  HERO_VERSION_CONFLICT: 'Este herói foi modificado por outro usuário. Verifique as alterações.',
  HERO_INACTIVE: 'Este herói está inativo e não pode ser escalado em missões.',
  MISSION_SCHEDULE_CONFLICT: 'O herói já possui outra missão agendada neste horário.',
  INVALID_MISSION_STATUS_TRANSITION: 'Transição de situação de missão inválida.',
  MISSION_ALREADY_FINISHED: 'Esta missão já foi finalizada e não pode ser alterada.',
  MISSION_REQUIRES_HEROES: 'A missão deve conter pelo menos um herói para ser iniciada.',
  FILE_TOO_LARGE: 'O arquivo enviado excede o limite máximo permitido de 2 MB.',
  INVALID_FILE_TYPE: 'Formato de arquivo inválido. Formatos aceitos: PNG, JPEG, WEBP e GIF.',
  INVALID_PAYLOAD: 'Dados da requisição inválidos ou malformados.',
  NETWORK_ERROR: 'Não foi possível conectar à API. Verifique se o servidor está no ar e tente novamente.',
  HTTP_ERROR: 'O servidor respondeu com erro. Tente novamente mais tarde.',
  IMPORT_FAILED: 'Falha ao processar a importação do arquivo CSV.',
};

const TECHNICAL_PATTERNS = [
  /sql/i,
  /mysql/i,
  /er_/i,
  /duplicate entry/i,
  /database/i,
  /syntaxerror/i,
  /internal server error/i,
  /uncaught/i,
  /stack trace/i,
  /econnrefused/i,
  /etimedout/i,
  /failed to fetch/i,
  /cannot read propert/i,
];

/**
 * Maps an API error code or raw message into clean, user-friendly Portuguese copy.
 * Sanitizes stack traces, database exceptions and technical error messages.
 */
export function getFriendlyErrorMessage(
  code?: string | null,
  rawMessage?: string | null,
  fallback = 'Ocorreu um erro ao processar sua solicitação. Tente novamente.',
): string {
  if (code && ERROR_CODE_TRANSLATIONS[code]) {
    return ERROR_CODE_TRANSLATIONS[code]!;
  }

  if (rawMessage && rawMessage.trim().length > 0) {
    const trimmed = rawMessage.trim();
    const isTechnical = TECHNICAL_PATTERNS.some((pattern) => pattern.test(trimmed));
    if (!isTechnical) {
      return trimmed;
    }
  }

  return fallback;
}

/**
 * Resolves an unknown caught error into a friendly Portuguese message for UI toast/banners.
 */
export function resolveApiErrorMessage(
  error: unknown,
  fallback = 'Ocorreu um erro inesperado. Tente novamente.',
): string {
  if (!error) return fallback;

  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: unknown; message?: unknown };
    const code = typeof candidate.code === 'string' ? candidate.code : null;
    const msg = typeof candidate.message === 'string' ? candidate.message : null;
    return getFriendlyErrorMessage(code, msg, fallback);
  }

  if (typeof error === 'string') {
    return getFriendlyErrorMessage(null, error, fallback);
  }

  return fallback;
}
