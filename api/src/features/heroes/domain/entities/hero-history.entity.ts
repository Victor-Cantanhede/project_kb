import type { HistoryField } from './hero.entity.js';

export interface HeroHistoryProps {
  id: number | string;
  hero_id: string;
  field: HistoryField | string;
  old_value: string | null;
  new_value: string | null;
  changed_at: Date;
}

export class HeroHistoryEntity {
  readonly id: string;
  readonly hero_id: string;
  readonly field: HistoryField | string;
  readonly old_value: string | null;
  readonly new_value: string | null;
  readonly changed_at: Date;

  constructor(props: HeroHistoryProps) {
    this.id = String(props.id);
    this.hero_id = props.hero_id;
    this.field = props.field;
    this.old_value = props.old_value;
    this.new_value = props.new_value;
    this.changed_at = props.changed_at;
  }

  static create(props: HeroHistoryProps): HeroHistoryEntity {
    return new HeroHistoryEntity(props);
  }
}
