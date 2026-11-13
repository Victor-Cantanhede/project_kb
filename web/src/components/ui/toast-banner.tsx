export interface ToastBannerProps {
  readonly message: string | null;
  readonly onClose: () => void;
}

export function ToastBanner({ message, onClose }: ToastBannerProps) {
  if (!message) return null;

  return (
    <div className="toast-banner" role="status">
      <span>{message}</span>
      <button
        type="button"
        className="toast-close"
        onClick={onClose}
        aria-label="Fechar aviso"
      >
        ✕
      </button>
    </div>
  );
}
