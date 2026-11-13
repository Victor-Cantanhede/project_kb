export type MissionStatus = 'scheduled' | 'in_progress' | 'succeeded' | 'failed' | 'cancelled';
export type MissionOutcome = 'succeeded' | 'failed';

export interface MissionHeroSummary {
  readonly id: string;
  readonly nickname: string;
}

export interface Mission {
  readonly id: string;
  readonly title: string;
  readonly starts_at: string;
  readonly ends_at: string;
  readonly status: MissionStatus;
  readonly heroes: readonly MissionHeroSummary[];
}

export interface CreateMissionPayload {
  readonly title: string;
  readonly starts_at: string;
  readonly ends_at: string;
}
