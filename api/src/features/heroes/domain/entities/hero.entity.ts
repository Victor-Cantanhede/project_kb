export const HERO_LIMITS = {
  name: 120,
  nickname: 60,
  universe: 60,
  main_power: 60,
  avatar_url: 2048,
} as const;

export const MIN_DATE_OF_BIRTH = '1000-01-01';

export const EDITABLE_FIELDS = [
  'name',
  'nickname',
  'date_of_birth',
  'universe',
  'main_power',
  'avatar_url',
] as const;

export const HISTORY_FIELDS = [...EDITABLE_FIELDS, 'is_active'] as const;
export type HistoryField = (typeof HISTORY_FIELDS)[number];

export interface HeroProps {
  id: string;
  name: string;
  nickname: string;
  date_of_birth: string;
  universe: string;
  main_power: string;
  avatar_url: string | null;
  is_active: boolean;
  version: number;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export class HeroEntity {
  readonly id: string;
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
  readonly deleted_at: Date | null;

  constructor(props: HeroProps) {
    this.id = props.id;
    this.name = props.name;
    this.nickname = props.nickname;
    this.date_of_birth = props.date_of_birth;
    this.universe = props.universe;
    this.main_power = props.main_power;
    this.avatar_url = props.avatar_url ?? null;
    this.is_active = props.is_active;
    this.version = props.version;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
    this.deleted_at = props.deleted_at ?? null;
  }

  static create(props: HeroProps): HeroEntity {
    return new HeroEntity(props);
  }
}
