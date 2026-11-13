const PAN_KEYS = new Set(['number', 'cardnumber', 'pan', 'creditcard']);
const CVV_KEYS = new Set(['cvv', 'cvc', 'cardcvv', 'securitycode']);
const SECRET_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'temporarypassword',
  'passwordhash',
  'verificationcode',
  'verificationurl',
  'authorization',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'jwt',
  'secret',
  'apikey',
  'secretkey',
  'resendapikey',
  'clientsecret',
  'privatekey',
  'authtoken',
  'sessiontoken',
  'webhooksecret',
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[-_]/g, '');
}

function maskPanValue(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return '****';
  }
  const digits = String(value).replace(/\D/g, '');
  return digits.length >= 8 ? `**** **** **** ${digits.slice(-4)}` : '****';
}

export interface SanitizeStringOptions {
  maskLongNumbers?: boolean;
}

function stripControlChars(input: string): string {
  let result = '';
  let inControlRun = false;

  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    if (code <= 31 || code === 127 || code === 0x2028 || code === 0x2029 || code === 0x0085) {
      if (!inControlRun) {
        result += ' ';
        inControlRun = true;
      }
    } else {
      result += input[i];
      inControlRun = false;
    }
  }

  return result;
}

/**
 * Remove caracteres de controle (anti log-injection CWE-117) e redacta credenciais,
 * tokens JWT, URLs de banco com senha, query params sensíveis e padrões de PAN.
 */
export function sanitizeLogString(
  input: string,
  options: SanitizeStringOptions = {},
): string {
  if (typeof input !== 'string') {
    if (input !== null && typeof input === 'object' && Object.getPrototypeOf(input) === null) {
      return '[Object: null prototype]';
    }
    try {
      return String(input ?? '');
    } catch {
      return '';
    }
  }

  let sanitized = stripControlChars(input)
    .replace(/\b(?:sk|pk|rk)_(?:test|live)_[A-Za-z0-9_]+\b/gi, '[REDACTED_KEY]')
    .replace(/\bre_[A-Za-z0-9_]{10,}\b/g, '[REDACTED_KEY]')
    .replace(/\b(?:Basic|Bearer)\s+[A-Za-z0-9+/=._-]+\b/gi, '[REDACTED_AUTH]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_JWT]')
    .replace(/([?&](?:code|token|password|key|secret)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/((?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^:\s\/@]+:)[^\/\s]+(@[^@\/\s:]+(?::\d+)?(?=[/?\s]|$))/gi, '$1[REDACTED]$2')
    .replace(/(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g, (match) => {
      const digits = match.replace(/\D/g, '');
      if (digits.length >= 13 && digits.length <= 19) {
        return `**** **** **** ${digits.slice(-4)}`;
      }
      return match;
    });

  if (options.maskLongNumbers) {
    sanitized = sanitized.replace(/\d{6,}/g, '***');
  }

  return sanitized;
}

/**
 * Redacta chaves de API, cabeçalhos de autorização, tokens e sequências numéricas longas em mensagens de erro.
 */
export function sanitizeErrorMessage(message: string): string {
  return sanitizeLogString(message, { maskLongNumbers: true });
}

/**
 * Extrai apenas os últimos 4 dígitos numéricos quando houver string com >= 4 dígitos;
 * descarta o restante do PAN imediatamente.
 */
export function extractSafeLastFour(rawCardNumber: unknown): string | null {
  if (typeof rawCardNumber !== 'string') {
    return null;
  }
  const digits = rawCardNumber.replace(/\D/g, '');
  if (digits.length < 4) {
    return null;
  }
  return digits.slice(-4);
}

/**
 * Sanitiza profundamente payloads, arrays e erros para logging/auditoria sem quebrar em referências circulares.
 */
export function sanitizeForLog<T>(value: T, maxDepth = 8): unknown {
  const seen = new WeakSet<object>();

  const walk = (current: unknown, depth: number): unknown => {
    if (current === null || current === undefined) {
      return current;
    }

    if (typeof current === 'string') {
      return sanitizeLogString(current);
    }

    if (typeof current === 'number' || typeof current === 'boolean') {
      return current;
    }

    if (typeof current === 'bigint') {
      return current.toString();
    }

    if (current instanceof Date) {
      return Number.isNaN(current.getTime()) ? '[Invalid Date]' : current.toISOString();
    }

    if (current instanceof Error) {
      return {
        name: sanitizeLogString(current.name),
        message: sanitizeErrorMessage(current.message),
      };
    }

    if (typeof current !== 'object') {
      return sanitizeLogString(String(current));
    }

    if (depth >= maxDepth) {
      return '[MaxDepth]';
    }

    if (seen.has(current)) {
      return '[Circular]';
    }

    seen.add(current);
    try {
      if (Array.isArray(current)) {
        return current.map((item) => walk(item, depth + 1));
      }

      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(current as Record<string, unknown>)) {
        const normalized = normalizeKey(key);
        if (PAN_KEYS.has(normalized)) {
          result[key] = maskPanValue(val);
        } else if (CVV_KEYS.has(normalized)) {
          result[key] = '***';
        } else if (SECRET_KEYS.has(normalized)) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = walk(val, depth + 1);
        }
      }
      return result;
    } finally {
      seen.delete(current);
    }
  };

  return walk(value, 0);
}
