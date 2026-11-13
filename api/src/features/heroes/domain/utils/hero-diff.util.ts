import {
  EDITABLE_FIELDS,
  type HeroEntity,
  type HistoryField,
} from '../entities/hero.entity.js';

export interface HeroChange {
  readonly field: HistoryField;
  readonly old_value: string | null;
  readonly new_value: string | null;
}

/**
 * Compares current hero with incoming patch, producing a list of changes
 * for any editable field whose value is explicitly provided and differs from current.
 */
export function diffHero(
  current: Pick<HeroEntity, 'name' | 'nickname' | 'date_of_birth' | 'universe' | 'main_power' | 'avatar_url'>,
  patch: Partial<Pick<HeroEntity, 'name' | 'nickname' | 'date_of_birth' | 'universe' | 'main_power' | 'avatar_url'>>,
): readonly HeroChange[] {
  return EDITABLE_FIELDS.flatMap((field) => {
    const next = patch[field];
    if (next === undefined || next === current[field]) return [];
    return [{ field, old_value: current[field], new_value: next }];
  });
}

/**
 * Creates a HeroChange representing an activation state transition.
 */
export function activationChange(
  current: { is_active: boolean },
  active: boolean,
): HeroChange {
  return {
    field: 'is_active',
    old_value: String(current.is_active),
    new_value: String(active),
  };
}
