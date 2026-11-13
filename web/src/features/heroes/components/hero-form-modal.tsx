import { useHeroForm } from '../hooks/use-hero-form.js';
import type { Hero } from '../types/heroes.types.js';

export interface HeroFormModalProps {
  readonly heroToEdit: Hero | null;
  readonly onClose: () => void;
  readonly onSaved: (saved: Hero, message: string) => void;
}

export function HeroFormModal({ heroToEdit, onClose, onSaved }: HeroFormModalProps) {
  const {
    baseHero,
    values,
    setField,
    submitState,
    fieldError,
    isBusy,
    handleAvatarFileChange,
    handleMergeConflict,
    handleSubmit,
  } = useHeroForm(heroToEdit, onSaved);

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
