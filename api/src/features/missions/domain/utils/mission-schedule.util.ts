import { DomainError } from '../../../../core/errors/domain.exception.js';
import type { MissionStatus } from '../entities/mission.entity.js';

export function doPeriodsOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
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
