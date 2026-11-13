import { useCallback, useEffect, useState } from 'react';
import { ApiClientError, type AsyncState } from '../../../lib/index.js';
import { HeroesApiService, type Hero } from '../../heroes/index.js';
import { MissionsApiService } from '../services/missions-api.service.js';
import type { Mission, MissionOutcome } from '../types/missions.types.js';

export function useMissionDetail(
  mission: Mission,
  onUpdated: (mission: Mission, message?: string) => void,
) {
  const [heroSearch, setHeroSearch] = useState('');
  const [candidatesState, setCandidatesState] = useState<AsyncState<readonly Hero[]>>({
    status: 'loading',
  });
  const [busyAction, setBusyAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadCandidates = useCallback(async (term: string) => {
    setCandidatesState({ status: 'loading' });
    try {
      // Consumes HeroesApiService strictly via features/heroes public barrel
      const page = await HeroesApiService.listHeroes({ search: term, limit: 20 });
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

  const assignHero = (hero: Hero): void => {
    void runAction(
      () => MissionsApiService.assignHeroToMission(mission.id, hero.id),
      `${hero.nickname} escalado na missão.`,
    );
  };

  const removeHero = (heroId: string, heroNickname: string): void => {
    void runAction(
      () => MissionsApiService.removeHeroFromMission(mission.id, heroId),
      `${heroNickname} removido da missão.`,
    );
  };

  const startMission = (): void => {
    void runAction(
      () => MissionsApiService.startMission(mission.id),
      'Missão iniciada!',
    );
  };

  const finishMission = (outcome: MissionOutcome): void => {
    const label = outcome === 'succeeded' ? 'Sucesso' : 'Fracasso';
    void runAction(
      () => MissionsApiService.finishMission(mission.id, outcome),
      `Missão encerrada com resultado: ${label}.`,
    );
  };

  const cancelMission = (): void => {
    void runAction(
      () => MissionsApiService.cancelMission(mission.id),
      'Missão cancelada.',
    );
  };

  return {
    heroSearch,
    setHeroSearch,
    candidatesState,
    loadCandidates,
    assignedIds,
    busyAction,
    actionError,
    assignHero,
    removeHero,
    startMission,
    finishMission,
    cancelMission,
  };
}
