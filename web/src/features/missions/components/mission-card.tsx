import type { Mission } from '../types/missions.types.js';
import {
  formatLocalDateTime,
  MISSION_STATUS_LABELS,
} from '../utils/mission-formatters.js';

export interface MissionCardProps {
  readonly mission: Mission;
  readonly onSelect: () => void;
}

export function MissionCard({ mission, onSelect }: MissionCardProps) {
  return (
    <article
      className="mission-card"
      onClick={onSelect}
    >
      <div className="mission-card-top">
        <h3 className="mission-card-title" title={mission.title}>
          {mission.title}
        </h3>
        <span className={`status-badge status-${mission.status}`}>
          {MISSION_STATUS_LABELS[mission.status]}
        </span>
      </div>

      <div className="mission-card-Schedule">
        <div>
          <strong>Início:</strong> {formatLocalDateTime(mission.starts_at)}
        </div>
        <div>
          <strong>Fim:</strong> {formatLocalDateTime(mission.ends_at)}
        </div>
      </div>

      <div className="mission-card-heroes">
        {mission.heroes.length === 0 ? (
          <span className="muted-inline">Nenhum herói escalado</span>
        ) : (
          mission.heroes.map((h) => (
            <span key={h.id} className="hero-chip">
              {h.nickname}
            </span>
          ))
        )}
      </div>
    </article>
  );
}
