import { useMissionCreate } from '../hooks/use-mission-create.js';
import type { Mission } from '../types/missions.types.js';

export interface MissionCreateModalProps {
  readonly onClose: () => void;
  readonly onCreated: (mission: Mission) => void;
}

export function MissionCreateModal({ onClose, onCreated }: MissionCreateModalProps) {
  const {
    title,
    setTitle,
    startsAtLocal,
    setStartsAtLocal,
    endsAtLocal,
    setEndsAtLocal,
    saving,
    errorMessage,
    fieldErrors,
    handleSubmit,
  } = useMissionCreate(onCreated);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="mission-create-title">
      <div className="modal-card">
        <div className="modal-header">
          <h2 id="mission-create-title">Criar missão</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fechar modal">
            ✕
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="modal-body">
            {errorMessage && (
              <div className="alert-banner alert-error" role="alert">
                {errorMessage}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="mission-title">Título</label>
              <input
                id="mission-title"
                type="text"
                className={fieldErrors.title ? 'input-pill input-error' : 'input-pill'}
                placeholder="Ex.: Proteger a ponte"
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {fieldErrors.title && <span className="field-error-text">{fieldErrors.title}</span>}
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="mission-starts">Começo (seu fuso horário)</label>
                <input
                  id="mission-starts"
                  type="datetime-local"
                  className={fieldErrors.starts_at ? 'input-pill input-error' : 'input-pill'}
                  value={startsAtLocal}
                  onChange={(e) => setStartsAtLocal(e.target.value)}
                />
                {fieldErrors.starts_at && (
                  <span className="field-error-text">{fieldErrors.starts_at}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="mission-ends">Fim (seu fuso horário)</label>
                <input
                  id="mission-ends"
                  type="datetime-local"
                  className={fieldErrors.ends_at ? 'input-pill input-error' : 'input-pill'}
                  value={endsAtLocal}
                  onChange={(e) => setEndsAtLocal(e.target.value)}
                />
                {fieldErrors.ends_at && (
                  <span className="field-error-text">{fieldErrors.ends_at}</span>
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary-rect" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
