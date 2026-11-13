import { PaginationBar, StateBox } from '../../../components/ui/index.js';
import { assertUnreachable } from '../../../lib/index.js';
import { useMissions } from '../hooks/use-missions.js';
import type { MissionStatus } from '../types/missions.types.js';
import { MissionCard } from './mission-card.js';
import { MissionCreateModal } from './mission-create-modal.js';
import { MissionDetailModal } from './mission-detail-modal.js';

export interface MissionsViewProps {
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

export function MissionsView({ onToast }: MissionsViewProps) {
  const {
    statusFilter,
    handleFilterChange,
    cursors,
    pageIdx,
    setPageIdx,
    resetPagination,
    missionsState,
    loadMissions,
    createOpen,
    setCreateOpen,
    selectedMission,
    setSelectedMission,
    handleMissionUpdated,
  } = useMissions(onToast);

  const renderContent = () => {
    switch (missionsState.status) {
      case 'loading':
        return <StateBox variant="loading" message="Carregando missões..." />;

      case 'error':
        return (
          <StateBox
            variant="error"
            title="Não foi possível carregar as missões"
            message={missionsState.message}
            onRetry={() => void loadMissions()}
          />
        );

      case 'success': {
        const { data, next_cursor } = missionsState.data;
        if (data.length === 0) {
          return (
            <StateBox
              variant="empty"
              title="Nenhuma missão encontrada"
              message="Crie uma nova missão ou altere o filtro de situação."
            />
          );
        }

        const totalKnownPages = next_cursor ? Math.max(cursors.length, pageIdx + 2) : pageIdx + 1;

        return (
          <>
            <div className="missions-grid">
              {data.map((mission) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  onSelect={() => setSelectedMission(mission)}
                />
              ))}
            </div>

            <PaginationBar
              pageIdx={pageIdx}
              totalKnownPages={totalKnownPages}
              hasNext={next_cursor !== null}
              onPageChange={setPageIdx}
              ariaLabel="Paginação de missões"
            />
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

      {renderContent()}

      {createOpen && (
        <MissionCreateModal
          onClose={() => setCreateOpen(false)}
          onCreated={(created) => {
            setCreateOpen(false);
            onToast(`Missão "${created.title}" criada.`);
            resetPagination();
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
