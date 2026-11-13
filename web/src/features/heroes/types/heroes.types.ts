export interface Hero {
  readonly id: string;
  readonly name: string;
  readonly nickname: string;
  readonly date_of_birth: string;
  readonly universe: string;
  readonly main_power: string;
  readonly avatar_url: string | null;
  readonly is_active: boolean;
  readonly version: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export type HistoryField =
  | 'name'
  | 'nickname'
  | 'date_of_birth'
  | 'universe'
  | 'main_power'
  | 'avatar_url'
  | 'is_active';

export interface HeroHistoryEntry {
  readonly id: string;
  readonly field: HistoryField;
  readonly old_value: string | null;
  readonly new_value: string | null;
  readonly changed_at: string;
}

export interface HeroSavePayload {
  readonly name: string;
  readonly nickname: string;
  readonly date_of_birth: string;
  readonly universe: string;
  readonly main_power: string;
  readonly avatar_url: string | null;
}
