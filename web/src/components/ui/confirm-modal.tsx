export interface ConfirmModalProps {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly tone?: 'primary' | 'danger';
  readonly isBusy: boolean;
  readonly errorMessage: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ConfirmModal({
  title,
  description,
  confirmLabel,
  tone = 'primary',
  isBusy,
  errorMessage,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div className="modal-card modal-card-sm">
        <div className="modal-header">
          <h2 id="confirm-modal-title">{title}</h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onCancel}
            disabled={isBusy}
            aria-label="Fechar modal"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {errorMessage && (
            <div className="alert-banner alert-error" role="alert">
              {errorMessage}
            </div>
          )}
          <p className="confirm-description">{description}</p>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-outline" onClick={onCancel} disabled={isBusy}>
            Cancelar
          </button>
          <button
            type="button"
            className={tone === 'danger' ? 'btn-danger-rect' : 'btn-primary-rect'}
            onClick={onConfirm}
            disabled={isBusy}
          >
            {isBusy ? 'Aguarde...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
