import type { MissionStatus } from '../types/missions.types.js';

export function formatLocalDateTime(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export const MISSION_STATUS_LABELS: Readonly<Record<MissionStatus, string>> = {
  scheduled: 'Agendada',
  in_progress: 'Em andamento',
  succeeded: 'Sucesso',
  failed: 'Fracasso',
  cancelled: 'Cancelada',
} as const;
