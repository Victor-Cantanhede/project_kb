export const MISSION_TITLE_MAX = 120;

export const MISSION_STATUSES = [
  'scheduled',
  'in_progress',
  'succeeded',
  'failed',
  'cancelled',
] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

export const MISSION_OUTCOMES = ['succeeded', 'failed'] as const;
export type MissionOutcome = (typeof MISSION_OUTCOMES)[number];

export interface MissionHeroSummary {
  readonly id: string;
  readonly nickname: string;
}

export interface MissionProps {
  readonly id: string;
  readonly title: string;
  readonly starts_at: Date;
  readonly ends_at: Date;
  readonly status: MissionStatus;
  readonly heroes?: readonly MissionHeroSummary[];
  readonly created_at?: Date;
  readonly updated_at?: Date;
}

export class MissionEntity {
  readonly id: string;
  readonly title: string;
  readonly starts_at: Date;
  readonly ends_at: Date;
  readonly status: MissionStatus;
  readonly heroes: readonly MissionHeroSummary[];
  readonly created_at?: Date;
  readonly updated_at?: Date;

  constructor(props: MissionProps) {
    this.id = props.id;
    this.title = props.title;
    this.starts_at = props.starts_at;
    this.ends_at = props.ends_at;
    this.status = props.status;
    this.heroes = props.heroes ? [...props.heroes] : [];
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }

  static create(props: MissionProps): MissionEntity {
    return new MissionEntity(props);
  }
}
