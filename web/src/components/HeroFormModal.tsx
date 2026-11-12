import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { api, type HeroSavePayload } from '../api.js';
import { ApiClientError, type Hero } from '../types.js';

interface HeroFormModalProps {
  readonly heroToEdit: Hero | null;
  readonly onClose: () => void;
  readonly onSaved: (saved: Hero, message: string) => void;
}

interface FormValues {
  readonly name: string;
  readonly nickname: string;
  readonly date_of_birth: string;
  readonly universe: string;
  readonly main_power: string;
  readonly avatar_url: string;
}

type SubmitState =
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
    typeof value.version === 'number'
  );
}

export function HeroFormModal({ heroToEdit, onClose, onSaved }: HeroFormModalProps) {
  // Stable idempotency key per modal session: clicking Salvar twice or retrying after a network drop creates only 1 hero.
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
      const uploaded = await api.uploadAvatar(file);
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
        const created = await api.createHero(payload, idempotencyKey);
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

      const updated = await api.updateHero(baseHero.id, patch);
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

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="hero-form-title">
      <div className="modal-card">
        <div className="modal-header">
          <h2 id="hero-form-title">{baseHero ? 'Editar herói' : 'Criar herói'}</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fechar modal">
            ✕
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="modal-body">
            {submitState.status === 'error' && (() => {
              const conflictHero = submitState.conflictHero;
              return (
                <div className="alert-banner alert-error" role="alert">
                  <p>{submitState.message}</p>
                  {conflictHero && (
                    <div className="conflict-box">
                      <p className="conflict-summary">
                        Versão atual no servidor: <strong>{conflictHero.nickname}</strong> (
                        {conflictHero.universe} · {conflictHero.main_power})
                      </p>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => handleMergeConflict(conflictHero)}
                      >
                        Atualizar dados sem perder o que digitei
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="form-group">
              <label htmlFor="hero-name">Nome completo</label>
              <input
                id="hero-name"
                type="text"
                className={fieldError('name') ? 'input-pill input-error' : 'input-pill'}
                placeholder="Digite o nome completo"
                maxLength={120}
                value={values.name}
                onChange={(e) => setField('name', e.target.value)}
              />
              {fieldError('name') && <span className="field-error-text">{fieldError('name')}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="hero-nickname">Nome de guerra</label>
              <input
                id="hero-nickname"
                type="text"
                className={fieldError('nickname') ? 'input-pill input-error' : 'input-pill'}
                placeholder="Digite o nome de guerra"
                maxLength={60}
                value={values.nickname}
                onChange={(e) => setField('nickname', e.target.value)}
              />
              {fieldError('nickname') && (
                <span className="field-error-text">{fieldError('nickname')}</span>
              )}
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="hero-dob">Data de nascimento</label>
                <input
                  id="hero-dob"
                  type="date"
                  className={fieldError('date_of_birth') ? 'input-pill input-error' : 'input-pill'}
                  placeholder="Digite a data"
                  value={values.date_of_birth}
                  onChange={(e) => setField('date_of_birth', e.target.value)}
                />
                {fieldError('date_of_birth') && (
                  <span className="field-error-text">{fieldError('date_of_birth')}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="hero-universe">Universo</label>
                <input
                  id="hero-universe"
                  type="text"
                  className={fieldError('universe') ? 'input-pill input-error' : 'input-pill'}
                  placeholder="Digite o universo"
                  maxLength={60}
                  value={values.universe}
                  onChange={(e) => setField('universe', e.target.value)}
                />
                {fieldError('universe') && (
                  <span className="field-error-text">{fieldError('universe')}</span>
                )}
              </div>
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="hero-power">Habilidade</label>
                <input
                  id="hero-power"
                  type="text"
                  className={fieldError('main_power') ? 'input-pill input-error' : 'input-pill'}
                  placeholder="Digite a habilidade"
                  maxLength={60}
                  value={values.main_power}
                  onChange={(e) => setField('main_power', e.target.value)}
                />
                {fieldError('main_power') && (
                  <span className="field-error-text">{fieldError('main_power')}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="hero-avatar">Avatar</label>
                <div className="avatar-input-group">
                  <input
                    id="hero-avatar"
                    type="text"
                    className={fieldError('avatar_url') ? 'input-pill input-error' : 'input-pill'}
                    placeholder="Digite a URL"
                    maxLength={2048}
                    value={values.avatar_url}
                    onChange={(e) => setField('avatar_url', e.target.value)}
                  />
                  <label className="upload-chip" title="Enviar imagem do computador">
                    {submitState.status === 'uploading_avatar' ? 'Enviando...' : 'Enviar arquivo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      hidden
                      disabled={isBusy}
                      onChange={(e) => void handleAvatarFileChange(e)}
                    />
                  </label>
                </div>
                {fieldError('avatar_url') && (
                  <span className="field-error-text">{fieldError('avatar_url')}</span>
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-outline" onClick={onClose} disabled={isBusy}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary-rect" disabled={isBusy}>
              {submitState.status === 'saving' ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
