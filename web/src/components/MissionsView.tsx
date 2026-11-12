import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../api.js';
import { formatLocalDateTime, MISSION_STATUS_LABELS } from '../format.js';
import {
  ApiClientError,
  assertUnreachable,
  updateCursorTrail,
  type AsyncState,
  type Hero,
  type Mission,
  type MissionOutcome,
  type MissionStatus,
  type Page,
} from '../types.js';

interface MissionsViewProps {
  readonly onToast: (message: string) => void;
}

const STATUS_FILTERS: readonly { readonly value: MissionStatus | ''; readonly label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'scheduled', label: 'Agendadas' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'succeeded', label: 'Sucesso' },
  { value: 'failed', label: 'Fracasso' },
  { value: 'cancelled', label: 'Canceladas' },
];

function defaultDateTimeLocal(hoursOffset: number): string {
  const date = new Date(Date.now() + hoursOffset * 3600_000);
  date.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function MissionsView({ onToast }: MissionsViewProps) {
  const [statusFilter, setStatusFilter] = useState<MissionStatus | ''>('');
  const [cursors, setCursors] = useState<readonly (string | null)[]>([null]);
  const [pageIdx, setPageIdx] = useState(0);
  const [missionsState, setMissionsState] = useState<AsyncState<Page<Mission>>>({
    status: 'loading',
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);

  const activeCursor = cursors[pageIdx] ?? null;

  const loadMissions = useCallback(async () => {
    setMissionsState({ status: 'loading' });
    try {
      const page = await api.listMissions({
        status: statusFilter,
        cursor: activeCursor,
        limit: 10,
      });
      if (page.data.length === 0 && pageIdx > 0) {
        setPageIdx((p) => Math.max(0, p - 1));
        return;
      }
      setMissionsState({ status: 'success', data: page });
      setCursors((prev) => updateCursorTrail(prev, pageIdx, page.next_cursor));
    } catch (error: unknown) {
      const message =
        error instanceof ApiClientError ? error.message : 'Erro ao carregar a lista de missões.';
      setMissionsState({ status: 'error', message });
    }
  }, [activeCursor, pageIdx, statusFilter]);

  useEffect(() => {
    void loadMissions();
  }, [loadMissions]);

  const handleFilterChange = (next: MissionStatus | ''): void => {
    setStatusFilter(next);
    setCursors([null]);
    setPageIdx(0);
  };

  const handleMissionUpdated = (updated: Mission, message?: string): void => {
    setSelectedMission(updated);
    if (message) onToast(message);
    void loadMissions();
  };

  const renderMissionsList = () => {
    switch (missionsState.status) {
      case 'loading':
        return (
          <div className="state-box" role="status">
            <div className="spinner" />
            <p>Carregando missões...</p>
          </div>
        );
      case 'error':
        return (
          <div className="state-box state-box-error" role="alert">
            <h3>Não foi possível carregar as missões</h3>
            <p>{missionsState.message}</p>
            <button type="button" className="btn-primary-pill" onClick={() => void loadMissions()}>
              Tentar novamente
            </button>
          </div>
        );
      case 'success': {
        const { data, next_cursor } = missionsState.data;
        if (data.length === 0) {
          return (
            <div className="state-box">
              <h3>Nenhuma missão encontrada</h3>
              <p>Crie uma nova missão ou altere o filtro de situação.</p>
            </div>
          );
        }
        const totalKnownPages = next_cursor ? Math.max(cursors.length, pageIdx + 2) : pageIdx + 1;
        return (
          <>
            <div className="missions-grid">
              {data.map((mission) => (
                <article
                  key={mission.id}
                  className="mission-card"
                  onClick={() => setSelectedMission(mission)}
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
              ))}
            </div>

            <nav className="pagination-bar" aria-label="Paginação de missões">
              <button
                type="button"
                className="page-arrow"
                disabled={pageIdx === 0}
                onClick={() => setPageIdx((p) => Math.max(0, p - 1))}
                aria-label="Página anterior"
              >
                ‹
              </button>
              {Array.from({ length: totalKnownPages }, (_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={idx === pageIdx ? 'page-num page-num-active' : 'page-num'}
                  onClick={() => setPageIdx(idx)}
                >
                  {idx + 1}
                </button>
              ))}
              <button
                type="button"
                className="page-arrow"
                disabled={next_cursor === null}
                onClick={() => setPageIdx((p) => p + 1)}
                aria-label="Próxima página"
              >
                ›
              </button>
            </nav>
          </>
        );
      }
      default:
        return assertUnreachable(missionsState);
    }
  };

  return (
    <section>
      <div className="toolbar-row missions-toolbar">
        <button
          type="button"
          className="btn-primary-pill"
          onClick={() => setCreateOpen(true)}
        >
          Criar missão
        </button>

        <div className="status-filter-pills" role="group" aria-label="Filtrar missões por situação">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={
                statusFilter === item.value ? 'filter-pill filter-pill-active' : 'filter-pill'
              }
              onClick={() => handleFilterChange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {renderMissionsList()}

      {createOpen && (
        <MissionCreateModal
          onClose={() => setCreateOpen(false)}
          onCreated={(created) => {
            setCreateOpen(false);
            onToast(`Missão "${created.title}" criada.`);
            setCursors([null]);
            setPageIdx(0);
            if (pageIdx === 0) void loadMissions();
            setSelectedMission(created);
          }}
        />
      )}

      {selectedMission && (
        <MissionDetailModal
          mission={selectedMission}
          onClose={() => setSelectedMission(null)}
          onUpdated={handleMissionUpdated}
        />
      )}
    </section>
  );
}

interface MissionCreateModalProps {
  readonly onClose: () => void;
  readonly onCreated: (mission: Mission) => void;
}

function MissionCreateModal({ onClose, onCreated }: MissionCreateModalProps) {
  const [title, setTitle] = useState('');
  const [startsAtLocal, setStartsAtLocal] = useState(() => defaultDateTimeLocal(1));
  const [endsAtLocal, setEndsAtLocal] = useState(() => defaultDateTimeLocal(3));
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMessage(null);
    setFieldErrors({});

    const startDate = new Date(startsAtLocal);
    const endDate = new Date(endsAtLocal);
    const dateErrors: Record<string, string> = {};
    if (Number.isNaN(startDate.getTime())) {
      dateErrors.starts_at = 'Informe uma data e hora de início válidas.';
    }
    if (Number.isNaN(endDate.getTime())) {
      dateErrors.ends_at = 'Informe uma data e hora de término válidas.';
    }
    if (Object.keys(dateErrors).length > 0) {
      setSaving(false);
      setErrorMessage('Informe datas e horários válidos.');
      setFieldErrors(dateErrors);
      return;
    }

    try {
      const created = await api.createMission({
        title,
        starts_at: startDate.toISOString(),
        ends_at: endDate.toISOString(),
      });
      onCreated(created);
    } catch (error: unknown) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
        const byField: Record<string, string> = {};
        for (const f of error.fields) byField[f.field] = f.message;
        setFieldErrors(byField);
      } else {
        setErrorMessage('Não foi possível criar a missão.');
      }
    } finally {
      setSaving(false);
    }
  };

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

interface MissionDetailModalProps {
  readonly mission: Mission;
  readonly onClose: () => void;
  readonly onUpdated: (mission: Mission, message?: string) => void;
}

function MissionDetailModal({ mission, onClose, onUpdated }: MissionDetailModalProps) {
  const [heroSearch, setHeroSearch] = useState('');
  const [candidatesState, setCandidatesState] = useState<AsyncState<readonly Hero[]>>({
    status: 'loading',
  });
  const [busyAction, setBusyAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadCandidates = useCallback(async (term: string) => {
    setCandidatesState({ status: 'loading' });
    try {
      const page = await api.listHeroes({ search: term, limit: 20 });
      setCandidatesState({
        status: 'success',
        data: page.data.filter((h) => h.is_active),
      });
    } catch (error: unknown) {
      setCandidatesState({
        status: 'error',
        message:
          error instanceof ApiClientError
            ? error.message
            : 'Erro ao buscar heróis disponíveis.',
      });
    }
  }, []);

  useEffect(() => {
    if (mission.status === 'scheduled') {
      void loadCandidates(heroSearch);
    }
  }, [heroSearch, loadCandidates, mission.status]);

  const assignedIds = new Set(mission.heroes.map((h) => h.id));

  const runAction = async (work: () => Promise<Mission>, successMessage: string): Promise<void> => {
    if (busyAction) return;
    setBusyAction(true);
    setActionError(null);
    try {
      const updated = await work();
      onUpdated(updated, successMessage);
    } catch (error: unknown) {
      setActionError(
        error instanceof ApiClientError
          ? error.message
          : 'Não foi possível concluir a operação.',
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handleFinish = (outcome: MissionOutcome): void => {
    const label = outcome === 'succeeded' ? 'Sucesso' : 'Fracasso';
    void runAction(
      () => api.finishMission(mission.id, outcome),
      `Missão encerrada com resultado: ${label}.`,
    );
  };

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
                  <span className="muted-inline">({hero.name} · {hero.main_power})</span>
                </div>
                <button
                  type="button"
                  className="btn-primary-rect btn-sm"
                  disabled={busyAction}
                  onClick={() =>
                    void runAction(
                      () => api.assignHeroToMission(mission.id, hero.id),
                      `${hero.nickname} escalado na missão.`,
                    )
                  }
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
                        onClick={() =>
                          void runAction(
                            () => api.removeHeroFromMission(mission.id, hero.id),
                            `${hero.nickname} removido da missão.`,
                          )
                        }
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
                  onClick={() =>
                    void runAction(() => api.startMission(mission.id), 'Missão iniciada!')
                  }
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
                    onClick={() => handleFinish('succeeded')}
                  >
                    Encerrar com Sucesso
                  </button>
                  <button
                    type="button"
                    className="btn-danger-rect"
                    disabled={busyAction}
                    onClick={() => handleFinish('failed')}
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
                  onClick={() =>
                    void runAction(() => api.cancelMission(mission.id), 'Missão cancelada.')
                  }
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

