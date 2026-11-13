import { useCallback, useEffect, useState } from 'react';
import {
  ApiClientError,
  updateCursorTrail,
  type AsyncState,
  type Page,
} from '../../../lib/index.js';
import type { Mission, MissionStatus } from '../../missions/index.js';
import { HeroesApiService } from '../services/heroes-api.service.js';
import type { Hero, HeroHistoryEntry, HistoryField } from '../types/heroes.types.js';

export function useHeroDetails(hero: Hero) {
  const [historyFilter, setHistoryFilter] = useState<HistoryField | ''>('');
  const [historyCursors, setHistoryCursors] = useState<readonly (string | null)[]>([null]);
  const [historyPageIdx, setHistoryPageIdx] = useState(0);
  const [historyState, setHistoryState] = useState<AsyncState<Page<HeroHistoryEntry>>>({
    status: 'loading',
  });

  const [missionFilter, setMissionFilter] = useState<MissionStatus | ''>('');
  const [missionCursors, setMissionCursors] = useState<readonly (string | null)[]>([null]);
  const [missionPageIdx, setMissionPageIdx] = useState(0);
  const [missionsState, setMissionsState] = useState<AsyncState<Page<Mission>>>({
    status: 'loading',
  });

  const activeHistoryCursor = historyCursors[historyPageIdx] ?? null;
  const activeMissionCursor = missionCursors[missionPageIdx] ?? null;

  const loadHistory = useCallback(async () => {
    setHistoryState({ status: 'loading' });
    try {
      const page = await HeroesApiService.listHeroHistory(hero.id, {
        field: historyFilter,
        cursor: activeHistoryCursor,
        limit: 5,
      });
      setHistoryState({ status: 'success', data: page });
      setHistoryCursors((prev) => updateCursorTrail(prev, historyPageIdx, page.next_cursor));
    } catch (error: unknown) {
      const message =
        error instanceof ApiClientError ? error.message : 'Erro ao carregar o histórico.';
      setHistoryState({ status: 'error', message });
    }
  }, [activeHistoryCursor, hero.id, historyFilter, historyPageIdx]);

  const loadMissions = useCallback(async () => {
    setMissionsState({ status: 'loading' });
    try {
      const page = await HeroesApiService.listHeroMissions(hero.id, {
        status: missionFilter,
        cursor: activeMissionCursor,
        limit: 5,
      });
      setMissionsState({ status: 'success', data: page });
      setMissionCursors((prev) => updateCursorTrail(prev, missionPageIdx, page.next_cursor));
    } catch (error: unknown) {
      const message =
        error instanceof ApiClientError ? error.message : 'Erro ao carregar as missões do herói.';
      setMissionsState({ status: 'error', message });
    }
  }, [activeMissionCursor, hero.id, missionFilter, missionPageIdx]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    void loadMissions();
  }, [loadMissions]);

  const handleHistoryFilterChange = (next: HistoryField | ''): void => {
    setHistoryFilter(next);
    setHistoryCursors([null]);
    setHistoryPageIdx(0);
  };

  const handleMissionFilterChange = (next: MissionStatus | ''): void => {
    setMissionFilter(next);
    setMissionCursors([null]);
    setMissionPageIdx(0);
  };

  return {
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
  };
}
