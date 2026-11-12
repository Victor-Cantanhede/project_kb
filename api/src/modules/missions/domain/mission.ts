import { z } from 'zod';
import { DomainError } from '../../../shared/kernel/errors.js';
import type { Brand } from '../../../shared/kernel/types.js';
import { requiredText } from '../../../shared/kernel/validation.js';
import type { HeroId } from '../../heroes/index.js';

export type MissionId = Brand<string, 'MissionId'>;
export const toMissionId = (value: string): MissionId => value as MissionId;

export const MISSION_TITLE_MAX = 120;

export const MISSION_STATUSES = ['scheduled', 'in_progress', 'succeeded', 'failed', 'cancelled'] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

export const MISSION_OUTCOMES = ['succeeded', 'failed'] as const;
export type MissionOutcome = (typeof MISSION_OUTCOMES)[number];

export interface MissionHeroSummary {
  readonly id: HeroId;
  readonly nickname: string;
}

export interface Mission {
  readonly id: MissionId;
  readonly title: string;
  readonly starts_at: Date;
  readonly ends_at: Date;
  readonly status: MissionStatus;
  readonly heroes: readonly MissionHeroSummary[];
}

export const missionCreateSchema = z
  .object({
    title: requiredText('o título da missão', MISSION_TITLE_MAX),
    starts_at: z.iso.datetime({ error: 'Informe a data e hora de início em formato ISO 8601.' }).transform((val) => new Date(val)),
    ends_at: z.iso.datetime({ error: 'Informe a data e hora de término em formato ISO 8601.' }).transform((val) => new Date(val)),
  })
  .refine((data) => data.ends_at.getTime() > data.starts_at.getTime(), {
    path: ['ends_at'],
    message: 'O horário de término deve ser posterior ao horário de início.',
  });

export type MissionCreateInput = z.output<typeof missionCreateSchema>;

export function doPeriodsOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime();
}

export function assertCanModifyRoster(status: MissionStatus): void {
  if (status !== 'scheduled') {
    throw new DomainError(
      'conflict',
      'MISSION_NOT_SCHEDULED',
      'Só é possível escalar ou remover heróis enquanto a missão está agendada.',
    );
  }
}

export function assertCanStart(status: MissionStatus, heroCount: number): void {
  if (status !== 'scheduled') {
    throw new DomainError(
      'conflict',
      'INVALID_MISSION_TRANSITION',
      'Só é possível iniciar uma missão que está agendada.',
    );
  }
  if (heroCount < 1) {
    throw new DomainError(
      'conflict',
      'MISSION_REQUIRES_HERO',
      'A missão precisa ter pelo menos 1 herói escalado para ser iniciada.',
    );
  }
}

export function assertCanFinish(status: MissionStatus): void {
  if (status !== 'in_progress') {
    throw new DomainError(
      'conflict',
      'INVALID_MISSION_TRANSITION',
      'Só é possível encerrar uma missão que está em andamento.',
    );
  }
}

export function assertCanCancel(status: MissionStatus): void {
  if (status !== 'scheduled' && status !== 'in_progress') {
    throw new DomainError(
      'conflict',
      'INVALID_MISSION_TRANSITION',
      'Não é possível cancelar uma missão já encerrada ou cancelada.',
    );
  }
}
