import type { ReactNode } from 'react';

export interface StateBoxProps {
  readonly variant: 'loading' | 'error' | 'empty';
  readonly title?: string;
  readonly message?: string;
  readonly onRetry?: () => void;
  readonly children?: ReactNode;
}

export function StateBox({
  variant,
  title,
  message,
  onRetry,
  children,
}: StateBoxProps) {
  if (variant === 'loading') {
    return (
      <div className="state-box" role="status">
        <div className="spinner" />
        <p>{message ?? 'Carregando...'}</p>
      </div>
    );
  }

  if (variant === 'error') {
    return (
      <div className="state-box state-box-error" role="alert">
        <h3>{title ?? 'Falha de comunicação'}</h3>
        <p>{message ?? 'Ocorreu um erro ao carregar os dados.'}</p>
        {onRetry && (
          <button type="button" className="btn-primary-pill" onClick={onRetry}>
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="state-box">
      {title && <h3>{title}</h3>}
      {message && <p>{message}</p>}
      {children}
    </div>
  );
}
