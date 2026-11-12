import { z } from 'zod';
import { validationError } from './errors.js';

z.config(z.locales.pt());

/** Parses untrusted input or throws a VALIDATION_ERROR listing every invalid field. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw validationError(
    result.error.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.map(String).join('.') : 'body',
      message: issue.path.length > 0 ? issue.message : 'Envie um objeto JSON válido.',
    })),
  );
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/** Required text: trimmed, whitespace-only counts as empty, bounded length, no control characters. */
export const requiredText = (label: string, max: number) =>
  z
    .string({ error: `Informe ${label}.` })
    .trim()
    .min(1, { error: `Informe ${label}.` })
    .max(max, { error: `Use no máximo ${max} caracteres.` })
    .refine((value) => !CONTROL_CHARS.test(value), { error: 'Contém caracteres inválidos.' });

