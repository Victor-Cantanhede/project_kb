import { z } from 'zod';
import { requiredText } from '../../../shared/kernel/validation.js';
import type { Brand } from '../../../shared/kernel/types.js';

export type HeroId = Brand<string, 'HeroId'>;
export const toHeroId = (value: string): HeroId => value as HeroId;

/** Documented maximum sizes (characters). */
export const HERO_LIMITS = { name: 120, nickname: 60, universe: 60, main_power: 60, avatar_url: 2048 } as const;
export const MIN_DATE_OF_BIRTH = '1000-01-01';

export interface Hero {
  readonly id: HeroId;
  readonly name: string;
  readonly nickname: string;
  readonly date_of_birth: string;
  readonly universe: string;
  readonly main_power: string;
  readonly avatar_url: string | null;
  readonly is_active: boolean;
  readonly version: number;
  readonly created_at: Date;
  readonly updated_at: Date;
}

/** Fields a person edits; every change to them (plus is_active) goes to the history. */
export const EDITABLE_FIELDS = ['name', 'nickname', 'date_of_birth', 'universe', 'main_power', 'avatar_url'] as const;
export const HISTORY_FIELDS = [...EDITABLE_FIELDS, 'is_active'] as const;
export type HistoryField = (typeof HISTORY_FIELDS)[number];

export function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Today's date (YYYY-MM-DD) in an IANA timezone; falls back to `fallbackZone` when the zone is unknown. */
export function todayIn(timeZone: string, now: Date, fallbackZone = 'UTC'): string {
  const format = (zone: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  try {
    return format(timeZone);
  } catch (error: unknown) {
    if (error instanceof RangeError) return format(fallbackZone);
    throw error;
  }
}

const dateOfBirth = (today: string) =>
  z
    .string({ error: 'Informe a data de nascimento.' })
    .trim()
    .refine(isCalendarDay, { error: 'Use uma data válida no formato AAAA-MM-DD.' })
    .refine((day) => day >= MIN_DATE_OF_BIRTH, { error: 'A data de nascimento deve ser a partir do ano 1000.' })
    .refine((day) => day <= today, { error: 'A data de nascimento não pode ser no futuro.' });

const AVATAR_UPLOAD_PATH = /^\/api\/avatars\/[0-9a-f-]{36}$/;

function isAvatarUrl(value: string): boolean {
  if (AVATAR_UPLOAD_PATH.test(value)) return true;
  if (!URL.canParse(value)) return false;
  const { protocol } = new URL(value);
  return protocol === 'http:' || protocol === 'https:';
}

const avatarUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .string({ error: 'Informe uma URL de imagem.' })
    .trim()
    .max(HERO_LIMITS.avatar_url, { error: `Use no máximo ${HERO_LIMITS.avatar_url} caracteres.` })
    .refine(isAvatarUrl, { error: 'Informe uma URL http(s) válida.' })
    .nullable(),
);

/**
 * `today` is the requester's current day, so "not in the future" holds in their timezone.
 * Unknown keys (id, created_at, is_active, ...) are stripped: clients can't set server-owned fields.
 */
export const buildHeroCreateSchema = (today: string) =>
  z.object({
    name: requiredText('o nome completo', HERO_LIMITS.name),
    nickname: requiredText('o nome de guerra', HERO_LIMITS.nickname),
    date_of_birth: dateOfBirth(today),
    universe: requiredText('o universo', HERO_LIMITS.universe),
    main_power: requiredText('a habilidade', HERO_LIMITS.main_power),
    avatar_url: avatarUrl.optional().transform((value) => value ?? null),
  });

export type HeroCreateInput = z.output<ReturnType<typeof buildHeroCreateSchema>>;

export const buildHeroPatchSchema = (today: string) =>
  buildHeroCreateSchema(today)
    .partial()
    .extend({
      avatar_url: avatarUrl.optional(),
      version: z.number({ error: 'Informe a versão do herói que você abriu.' }).int().positive(),
    });
export type HeroPatchInput = z.output<ReturnType<typeof buildHeroPatchSchema>>;

export interface HeroChange {
  readonly field: HistoryField;
  readonly old_value: string | null;
  readonly new_value: string | null;
}

/** Fields present in the patch whose value differs from the current hero. */
export function diffHero(current: Hero, patch: HeroPatchInput): readonly HeroChange[] {
  return EDITABLE_FIELDS.flatMap((field) => {
    const next = patch[field];
    if (next === undefined || next === current[field]) return [];
    return [{ field, old_value: current[field], new_value: next }];
  });
}

export const activationChange = (current: Hero, active: boolean): HeroChange => ({
  field: 'is_active',
  old_value: String(current.is_active),
  new_value: String(active),
});
