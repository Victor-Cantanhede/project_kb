import { assertUnreachable } from '../../../lib/index.js';
import { useMissionDetail } from '../hooks/use-mission-detail.js';
import type { Mission } from '../types/missions.types.js';
import {
  formatLocalDateTime,
  MISSION_STATUS_LABELS,
} from '../utils/mission-formatters.js';

export interface MissionDetailModalProps {
  readonly mission: Mission;
  readonly onClose: () => void;
  readonly onUpdated: (mission: Mission, message?: string) => void;
}

export function MissionDetailModal({
  mission,
  onClose,
  onUpdated,
}: MissionDetailModalProps) {
  const {
    heroSearch,
    setHeroSearch,
    candidatesState,
    assignedIds,
    busyAction,
    actionError,
    assignHero,
    removeHero,
    startMission,
    finishMission,
    cancelMission,
  } = useMissionDetail(mission, onUpdated);

  const renderCandidatePicker = () => {
    switch (candidatesState.status) {
      case 'loading':
        return <p className="muted-state">Buscando heróis ativos...</p>;

      case 'error':
        return <p className="field-error-text">{candidatesState.message}</p>;

      case 'success': {
        const available = candidatesState.data.filter((h) => !assignedIds.has(h.id));
        if (available.length === 0) {
          return (
            <p className="muted-state">
              Nenhum herói ativo encontrado para escalar com essa busca.
            </p>
          );
        }
        return (
          <ul className="candidate-list">
            {available.slice(0, 8).map((hero) => (
              <li key={hero.id} className="candidate-row">
                <div>
                  <strong>{hero.nickname}</strong>{' '}
                  <span className="muted-inline">
                    ({hero.name} · {hero.main_power})
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-primary-rect btn-sm"
                  disabled={busyAction}
                  onClick={() => assignHero(hero)}
                >
                  Escalar
                </button>
              </li>
            ))}
          </ul>
        );
      }

      default:
        return assertUnreachable(candidatesState);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="mission-detail-title">
      <div className="modal-card modal-card-scrollable">
        <div className="modal-header">
          <h2 id="mission-detail-title" className="truncate-title" title={mission.title}>
            {mission.title}
          </h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fechar modal">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {actionError && (
            <div className="alert-banner alert-error" role="alert">
              {actionError}
            </div>
          )}

          <div className="detail-grid">
            <div className="detail-field">
              <span className="detail-label">Situação</span>
              <span className={`status-badge status-${mission.status}`}>
                {MISSION_STATUS_LABELS[mission.status]}
              </span>
            </div>
            <div className="detail-field">
              <span className="detail-label">Heróis escalados</span>
              <span className="detail-value">{mission.heroes.length}</span>
            </div>
            <div className="detail-field">
              <span className="detail-label">Começo (seu fuso)</span>
              <span className="detail-value">{formatLocalDateTime(mission.starts_at)}</span>
            </div>
            <div className="detail-field">
              <span className="detail-label">Fim (seu fuso)</span>
              <span className="detail-value">{formatLocalDateTime(mission.ends_at)}</span>
            </div>
          </div>

          <hr className="section-divider" />

          <section className="detail-section">
            <h3>Equipe escalada</h3>
            {mission.heroes.length === 0 ? (
              <p className="muted-state">Nenhum herói escalado nesta missão ainda.</p>
            ) : (
              <ul className="roster-list">
                {mission.heroes.map((hero) => (
                  <li key={hero.id} className="roster-row">
                    <span>
                      <strong>{hero.nickname}</strong>
                    </span>
                    {mission.status === 'scheduled' && (
                      <button
                        type="button"
                        className="btn-outline btn-sm btn-danger-outline"
                        disabled={busyAction}
                        onClick={() => removeHero(hero.id, hero.nickname)}
                      >
                        Tirar herói
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {mission.status === 'scheduled' && (
            <>
              <hr className="section-divider" />
              <section className="detail-section">
                <h3>Escalar herói ativo</h3>
                <input
                  type="search"
                  className="input-pill"
                  placeholder="Buscar herói ativo por nome ou nome de guerra..."
                  value={heroSearch}
                  onChange={(e) => setHeroSearch(e.target.value)}
                />
                {renderCandidatePicker()}
              </section>
            </>
          )}

          <hr className="section-divider" />

          <section className="detail-section">
            <h3>Mudar situação da missão</h3>
            <div className="mission-actions-bar">
              {mission.status === 'scheduled' && (
                <button
                  type="button"
                  className="btn-primary-rect"
                  disabled={busyAction || mission.heroes.length === 0}
                  title={
                    mission.heroes.length === 0
                      ? 'Escale pelo menos 1 herói antes de iniciar'
                      : 'Iniciar missão'
                  }
                  onClick={startMission}
                >
                  Iniciar missão
                </button>
              )}

              {mission.status === 'in_progress' && (
                <>
                  <button
                    type="button"
                    className="btn-success-rect"
                    disabled={busyAction}
                    onClick={() => finishMission('succeeded')}
                  >
                    Encerrar com Sucesso
                  </button>
                  <button
                    type="button"
                    className="btn-danger-rect"
                    disabled={busyAction}
                    onClick={() => finishMission('failed')}
                  >
                    Encerrar com Fracasso
                  </button>
                </>
              )}

              {(mission.status === 'scheduled' || mission.status === 'in_progress') && (
                <button
                  type="button"
                  className="btn-outline btn-danger-outline"
                  disabled={busyAction}
                  onClick={cancelMission}
                >
                  Cancelar missão
                </button>
              )}

              {mission.status !== 'scheduled' && mission.status !== 'in_progress' && (
                <p className="muted-state">
                  Esta missão já foi finalizada ({MISSION_STATUS_LABELS[mission.status]}) e não pode
                  mais mudar de situação.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-outline" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
