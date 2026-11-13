import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  ApiClientError,
  assertUnreachable,
  resolveApiErrorMessage,
  updateCursorTrail,
  type AsyncState,
  type Page,
} from '../../../lib/index.js';
import { HeroesApiService } from '../services/heroes-api.service.js';
import type { Hero } from '../types/heroes.types.js';

export interface HeroConfirmState {
  readonly action: 'activate' | 'deactivate' | 'delete';
  readonly hero: Hero;
}

export function useHeroes(onToast?: (message: string) => void) {
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [cursors, setCursors] = useState<readonly (string | null)[]>([null]);
  const [pageIdx, setPageIdx] = useState(0);
  const [heroesState, setHeroesState] = useState<AsyncState<Page<Hero>>>({ status: 'loading' });

  const [openMenuHeroId, setOpenMenuHeroId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<HeroConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Close card popover on click outside
  useEffect(() => {
    const closeMenu = () => setOpenMenuHeroId(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const activeCursor = cursors[pageIdx] ?? null;

  const loadHeroes = useCallback(async () => {
    setHeroesState({ status: 'loading' });
    try {
      const page = await HeroesApiService.listHeroes({
        search: appliedSearch,
        cursor: activeCursor,
        limit: 10,
      });

      if (page.data.length === 0 && pageIdx > 0) {
        setPageIdx((p) => Math.max(0, p - 1));
        return;
      }

      setHeroesState({ status: 'success', data: page });
      setCursors((prev) => updateCursorTrail(prev, pageIdx, page.next_cursor));
    } catch (error: unknown) {
      setHeroesState({
        status: 'error',
        message: resolveApiErrorMessage(error, 'Não foi possível carregar os heróis.'),
      });
    }
  }, [activeCursor, appliedSearch, pageIdx]);

  useEffect(() => {
    void loadHeroes();
  }, [loadHeroes]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
    setCursors([null]);
    setPageIdx(0);
  };

  const clearSearch = (): void => {
    setSearchInput('');
    setAppliedSearch('');
    setCursors([null]);
    setPageIdx(0);
  };

  const resetPagination = (): void => {
    setCursors([null]);
    setPageIdx(0);
  };

  const openConfirm = (action: 'activate' | 'deactivate' | 'delete', hero: Hero): void => {
    setOpenMenuHeroId(null);
    setConfirmError(null);
    setConfirmModal({ action, hero });
  };

  const closeConfirm = (): void => {
    if (confirmBusy) return;
    setConfirmModal(null);
    setConfirmError(null);
  };

  const handleConfirmAction = async (): Promise<void> => {
    if (!confirmModal || confirmBusy) return;
    setConfirmBusy(true);
    setConfirmError(null);
    const { action, hero } = confirmModal;

    try {
      switch (action) {
        case 'activate':
          await HeroesApiService.activateHero(hero.id);
          onToast?.(`Herói "${hero.nickname}" ativado.`);
          break;
        case 'deactivate':
          await HeroesApiService.deactivateHero(hero.id);
          onToast?.(`Herói "${hero.nickname}" inativado.`);
          break;
        case 'delete':
          await HeroesApiService.deleteHero(hero.id);
          onToast?.(`Herói "${hero.nickname}" excluído.`);
          break;
        default:
          assertUnreachable(action);
      }
      setConfirmModal(null);
      void loadHeroes();
    } catch (error: unknown) {
      setConfirmError(
        error instanceof ApiClientError ? error.message : 'Falha ao executar a ação.',
      );
    } finally {
      setConfirmBusy(false);
    }
  };

  return {
    searchInput,
    setSearchInput,
    appliedSearch,
    handleSearchSubmit,
    clearSearch,
    cursors,
    pageIdx,
    setPageIdx,
    resetPagination,
    heroesState,
    loadHeroes,
    openMenuHeroId,
    setOpenMenuHeroId,
    confirmModal,
    confirmBusy,
    confirmError,
    openConfirm,
    closeConfirm,
    handleConfirmAction,
  };
}
