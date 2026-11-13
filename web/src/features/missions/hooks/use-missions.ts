import { useCallback, useEffect, useState } from 'react';
import {
  ApiClientError,
  updateCursorTrail,
  type AsyncState,
  type Page,
} from '../../../lib/index.js';
import { MissionsApiService } from '../services/missions-api.service.js';
import type { Mission, MissionStatus } from '../types/missions.types.js';

export function useMissions(onToast?: (message: string) => void) {
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
      const page = await MissionsApiService.listMissions({
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
    if (message && onToast) onToast(message);
    void loadMissions();
  };

  const resetPagination = (): void => {
    setCursors([null]);
    setPageIdx(0);
  };

  return {
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
  };
}
