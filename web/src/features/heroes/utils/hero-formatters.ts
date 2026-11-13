import type { HeroHistoryEntry, HistoryField } from '../types/heroes.types.js';

/**
 * Formats a calendar day (YYYY-MM-DD) into DD/MM/YYYY without constructing a Date object,
 * guaranteeing that 1962-04-10 is displayed as 10/04/1962 in every timezone.
 */
export function formatBirthDate(ymd: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!parts) return ymd;
  return `${parts[3]}/${parts[2]}/${parts[1]}`;
}

export const HISTORY_FIELD_LABELS: Readonly<Record<HistoryField, string>> = {
  name: 'nome completo',
  nickname: 'nome de guerra',
  date_of_birth: 'data de nascimento',
  universe: 'universo',
  main_power: 'habilidade',
  avatar_url: 'avatar',
  is_active: 'situação',
} as const;

export function formatHistoryValue(field: HistoryField, value: string | null): string {
  if (value === null || value === '') return 'vazio';
  if (field === 'date_of_birth') return formatBirthDate(value);
  if (field === 'is_active') return value === 'true' ? 'Ativo' : 'Inativo';
  return value;
}

export function formatHistoryEntry(entry: HeroHistoryEntry): string {
  const date = new Date(entry.changed_at);
  const dayMonth = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const label = HISTORY_FIELD_LABELS[entry.field];
  const oldFormatted = formatHistoryValue(entry.field, entry.old_value);
  const newFormatted = formatHistoryValue(entry.field, entry.new_value);
  return `${dayMonth}, ${hours}h${minutes}: ${label} mudou de ${oldFormatted} para ${newFormatted}`;
}

export const DEFAULT_HERO_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b2569"/>
      <stop offset="100%" stop-color="#1e5799"/>
    </linearGradient>
  </defs>
  <circle cx="100" cy="100" r="100" fill="url(#bg)"/>
  <circle cx="100" cy="106" r="52" fill="#f4efe8"/>
  <polygon points="56,78 48,36 86,62" fill="#f4efe8"/>
  <polygon points="144,78 152,36 114,62" fill="#f4efe8"/>
  <rect x="52" y="84" width="96" height="28" rx="14" fill="#0b2569"/>
  <circle cx="80" cy="98" r="8" fill="#5eead4"/>
  <circle cx="120" cy="98" r="8" fill="#5eead4"/>
  <polygon points="94,118 106,118 100,126" fill="#e11d48"/>
  <path d="M40,168 Q100,140 160,168 L175,200 L25,200 Z" fill="#dc2626"/>
</svg>`);
