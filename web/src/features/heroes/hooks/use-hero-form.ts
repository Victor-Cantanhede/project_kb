import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { ApiClientError } from '../../../lib/index.js';
import { HeroesApiService } from '../services/heroes-api.service.js';
import type { Hero, HeroSavePayload } from '../types/heroes.types.js';

export interface FormValues {
  readonly name: string;
  readonly nickname: string;
  readonly date_of_birth: string;
  readonly universe: string;
  readonly main_power: string;
  readonly avatar_url: string;
}

export type SubmitState =
  | { readonly status: 'idle' }
  | { readonly status: 'saving' }
  | { readonly status: 'uploading_avatar' }
  | {
      readonly status: 'error';
      readonly message: string;
      readonly fieldErrors: Readonly<Record<string, string>>;
      readonly conflictHero: Hero | null;
    };

function toFormValues(hero: Hero | null): FormValues {
  return {
    name: hero?.name ?? '',
    nickname: hero?.nickname ?? '',
    date_of_birth: hero?.date_of_birth ?? '',
    universe: hero?.universe ?? '',
    main_power: hero?.main_power ?? '',
    avatar_url: hero?.avatar_url ?? '',
  };
}

function isHeroShape(value: unknown): value is Hero {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'version' in value &&
    typeof (value as { version: unknown }).version === 'number'
  );
}

export function useHeroForm(
  heroToEdit: Hero | null,
  onSaved: (saved: Hero, message: string) => void,
) {
  // Stable idempotency key per form session: clicking Salvar twice or retrying creates only 1 hero.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const [baseHero, setBaseHero] = useState<Hero | null>(heroToEdit);
  const [values, setValues] = useState<FormValues>(() => toFormValues(heroToEdit));
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  const setField = (field: keyof FormValues, value: string): void => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setSubmitState({ status: 'uploading_avatar' });
    try {
      const uploaded = await HeroesApiService.uploadAvatar(file);
      setValues((prev) => ({ ...prev, avatar_url: uploaded.url }));
      setSubmitState({ status: 'idle' });
    } catch (error: unknown) {
      const message =
        error instanceof ApiClientError ? error.message : 'Falha ao enviar a imagem de avatar.';
      setSubmitState({
        status: 'error',
        message,
        fieldErrors: { avatar_url: message },
        conflictHero: null,
      });
    }
  };

  const handleMergeConflict = (serverHero: Hero): void => {
    const initial = toFormValues(baseHero);
    // Preserve every field the current user modified; pull untouched fields from the server's latest version.
    setValues((current) => ({
      name: current.name !== initial.name ? current.name : serverHero.name,
      nickname: current.nickname !== initial.nickname ? current.nickname : serverHero.nickname,
      date_of_birth:
        current.date_of_birth !== initial.date_of_birth
          ? current.date_of_birth
          : serverHero.date_of_birth,
      universe: current.universe !== initial.universe ? current.universe : serverHero.universe,
      main_power:
        current.main_power !== initial.main_power ? current.main_power : serverHero.main_power,
      avatar_url:
        current.avatar_url !== initial.avatar_url
          ? current.avatar_url
          : (serverHero.avatar_url ?? ''),
    }));
    setBaseHero(serverHero);
    setSubmitState({ status: 'idle' });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (submitState.status === 'saving' || submitState.status === 'uploading_avatar') return;
    setSubmitState({ status: 'saving' });

    const payload: HeroSavePayload = {
      name: values.name,
      nickname: values.nickname,
      date_of_birth: values.date_of_birth,
      universe: values.universe,
      main_power: values.main_power,
      avatar_url: values.avatar_url.trim().length > 0 ? values.avatar_url.trim() : null,
    };

    try {
      if (!baseHero) {
        const created = await HeroesApiService.createHero(payload, idempotencyKey);
        onSaved(created, `Herói "${created.nickname}" salvo com sucesso.`);
        return;
      }

      // Only send fields the user actually changed relative to baseHero, so concurrent edits on different fields merge cleanly.
      const patch: Partial<HeroSavePayload> & { readonly version: number } = {
        version: baseHero.version,
        ...(payload.name !== baseHero.name ? { name: payload.name } : {}),
        ...(payload.nickname !== baseHero.nickname ? { nickname: payload.nickname } : {}),
        ...(payload.date_of_birth !== baseHero.date_of_birth
          ? { date_of_birth: payload.date_of_birth }
          : {}),
        ...(payload.universe !== baseHero.universe ? { universe: payload.universe } : {}),
        ...(payload.main_power !== baseHero.main_power ? { main_power: payload.main_power } : {}),
        ...(payload.avatar_url !== baseHero.avatar_url ? { avatar_url: payload.avatar_url } : {}),
      };

      const updated = await HeroesApiService.updateHero(baseHero.id, patch);
      onSaved(updated, `Herói "${updated.nickname}" atualizado com sucesso.`);
    } catch (error: unknown) {
      if (error instanceof ApiClientError) {
        const fieldErrors: Record<string, string> = {};
        for (const item of error.fields) {
          fieldErrors[item.field] = item.message;
        }
        const conflictHero =
          error.code === 'HERO_VERSION_CONFLICT' && isHeroShape(error.details.current_hero)
            ? error.details.current_hero
            : null;
        setSubmitState({
          status: 'error',
          message: error.message,
          fieldErrors,
          conflictHero,
        });
        return;
      }
      setSubmitState({
        status: 'error',
        message: 'Não foi possível salvar o herói. Tente novamente.',
        fieldErrors: {},
        conflictHero: null,
      });
    }
  };

  const fieldError = (name: string): string | undefined =>
    submitState.status === 'error' ? submitState.fieldErrors[name] : undefined;

  const isBusy = submitState.status === 'saving' || submitState.status === 'uploading_avatar';

  return {
    baseHero,
    values,
    setField,
    submitState,
    fieldError,
    isBusy,
    handleAvatarFileChange,
    handleMergeConflict,
    handleSubmit,
  };
}
