import { assertUnreachable } from '../../../lib/index.js';
import {
  formatLocalDateTime,
  MISSION_STATUS_LABELS,
  type MissionStatus,
} from '../../missions/index.js';
import { useHeroDetails } from '../hooks/use-hero-details.js';
import type { Hero, HistoryField } from '../types/heroes.types.js';
import {
  DEFAULT_HERO_AVATAR,
  formatBirthDate,
  formatHistoryEntry,
  HISTORY_FIELD_LABELS,
} from '../utils/hero-formatters.js';

export interface HeroDetailsModalProps {
  readonly hero: Hero;
  readonly onClose: () => void;
}

const HISTORY_FILTER_OPTIONS: readonly { readonly value: HistoryField | ''; readonly label: string }[] = [
  { value: '', label: 'Todos os campos' },
  ...Object.entries(HISTORY_FIELD_LABELS).map(([value, label]) => ({
    value: value as HistoryField,
    label: `Campo: ${label}`,
  })),
];

const MISSION_FILTER_OPTIONS = [
  { value: '', label: 'Todas as situações' },
  { value: 'scheduled', label: 'Agendada' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'succeeded', label: 'Sucesso' },
  { value: 'failed', label: 'Fracasso' },
  { value: 'cancelled', label: 'Cancelada' },
] as const;

export function HeroDetailsModal({ hero, onClose }: HeroDetailsModalProps) {
  const {
    historyFilter,
    historyPageIdx,
    setHistoryPageIdx,
    historyState,
    loadHistory,
    handleHistoryFilterChange,
    missionFilter,
    missionPageIdx,
    setMissionPageIdx,
    missionsState,
    loadMissions,
    handleMissionFilterChange,
  } = useHeroDetails(hero);

  const renderHistoryContent = () => {
    switch (historyState.status) {
      case 'loading':
        return <p className="muted-state">Carregando histórico...</p>;
      case 'error':
        return (
          <div className="inline-error-state">
            <span>{historyState.message}</span>
            <button type="button" className="btn-outline btn-sm" onClick={() => void loadHistory()}>
              Tentar novamente
            </button>
          </div>
        );
      case 'success': {
        const { data, next_cursor } = historyState.data;
        if (data.length === 0) {
          return <p className="muted-state">Nenhuma alteração registrada para este filtro.</p>;
        }
        return (
          <>
            <ul className="history-list">
              {data.map((entry) => (
                <li key={entry.id} className="history-item">
                  {formatHistoryEntry(entry)}
                </li>
              ))}
            </ul>
            <div className="mini-pager">
              <button
                type="button"
                className="pager-arrow"
                disabled={historyPageIdx === 0}
                onClick={() => setHistoryPageIdx((p) => Math.max(0, p - 1))}
              >
                ‹ Anterior
              </button>
              <span className="mini-pager-info">Página {historyPageIdx + 1}</span>
              <button
                type="button"
                className="pager-arrow"
                disabled={next_cursor === null}
                onClick={() => setHistoryPageIdx((p) => p + 1)}
              >
                Próxima ›
              </button>
            </div>
          </>
        );
      }
      default:
        return assertUnreachable(historyState);
    }
  };

  const renderMissionsContent = () => {
    switch (missionsState.status) {
      case 'loading':
        return <p className="muted-state">Carregando missões...</p>;
      case 'error':
        return (
          <div className="inline-error-state">
            <span>{missionsState.message}</span>
            <button type="button" className="btn-outline btn-sm" onClick={() => void loadMissions()}>
              Tentar novamente
            </button>
          </div>
        );
      case 'success': {
        const { data, next_cursor } = missionsState.data;
        if (data.length === 0) {
          return <p className="muted-state">Nenhuma missão encontrada para este herói.</p>;
        }
        return (
          <>
            <ul className="history-list">
              {data.map((mission) => (
                <li key={mission.id} className="history-item mission-history-item">
                  <div>
                    <strong>{mission.title}</strong>
                    <div className="mission-history-dates">
                      {formatLocalDateTime(mission.starts_at)} até {formatLocalDateTime(mission.ends_at)}
                    </div>
                  </div>
                  <span className={`status-badge status-${mission.status}`}>
                    {MISSION_STATUS_LABELS[mission.status]}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mini-pager">
              <button
                type="button"
                className="pager-arrow"
                disabled={missionPageIdx === 0}
                onClick={() => setMissionPageIdx((p) => Math.max(0, p - 1))}
              >
                ‹ Anterior
              </button>
              <span className="mini-pager-info">Página {missionPageIdx + 1}</span>
              <button
                type="button"
                className="pager-arrow"
                disabled={next_cursor === null}
                onClick={() => setMissionPageIdx((p) => p + 1)}
              >
                Próxima ›
              </button>
            </div>
          </>
        );
      }
      default:
        return assertUnreachable(missionsState);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="hero-detail-title">
      <div className="modal-card modal-card-scrollable">
        <div className="modal-header">
          <h2 id="hero-detail-title" className="truncate-title" title={hero.nickname}>
            {hero.nickname}
          </h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fechar modal">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="detail-avatar-wrap">
            <img
              src={hero.avatar_url ?? DEFAULT_HERO_AVATAR}
              alt={hero.nickname}
              className={hero.is_active ? 'detail-avatar' : 'detail-avatar avatar-inactive'}
              onError={(e) => {
                e.currentTarget.src = DEFAULT_HERO_AVATAR;
              }}
            />
            {!hero.is_active && <span className="inactive-pill">Inativo</span>}
          </div>

          <div className="detail-grid">
            <div className="detail-field">
              <span className="detail-label">Nome completo:</span>
              <span className="detail-value">{hero.name}</span>
            </div>
            <div className="detail-field">
              <span className="detail-label">Data de nascimento</span>
              <span className="detail-value">{formatBirthDate(hero.date_of_birth)}</span>
            </div>
            <div className="detail-field">
              <span className="detail-label">Universo</span>
              <span className="detail-value">{hero.universe}</span>
            </div>
            <div className="detail-field">
              <span className="detail-label">Habilidade</span>
              <span className="detail-value">{hero.main_power}</span>
            </div>
          </div>

          <hr className="section-divider" />

          <section className="detail-section">
            <div className="detail-section-header">
              <h3>Histórico de alterações</h3>
              <select
                aria-label="Filtrar histórico por campo"
                className="select-compact"
                value={historyFilter}
                onChange={(e) => handleHistoryFilterChange(e.target.value as HistoryField | '')}
              >
                {HISTORY_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {renderHistoryContent()}
          </section>

          <hr className="section-divider" />

          <section className="detail-section">
            <div className="detail-section-header">
              <h3>Missões de que participou</h3>
              <select
                aria-label="Filtrar missões por situação"
                className="select-compact"
                value={missionFilter}
                onChange={(e) =>
                  handleMissionFilterChange(e.target.value as MissionStatus | '')
                }
              >
                {MISSION_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {renderMissionsContent()}
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
