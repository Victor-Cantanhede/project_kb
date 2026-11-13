import { useState } from 'react';
import { ConfirmModal, PaginationBar, StateBox } from '../../../components/ui/index.js';
import { assertUnreachable } from '../../../lib/index.js';
import { useHeroes } from '../hooks/use-heroes.js';
import type { Hero } from '../types/heroes.types.js';
import { HeroCard } from './hero-card.js';
import { HeroDetailsModal } from './hero-details-modal.js';
import { HeroFormModal } from './hero-form-modal.js';
import { HeroesToolbar } from './heroes-toolbar.js';

export interface HeroesViewProps {
  readonly onToast: (message: string) => void;
  readonly onOpenCsvImport: () => void;
}

export function HeroesView({ onToast, onOpenCsvImport }: HeroesViewProps) {
  const {
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
  } = useHeroes(onToast);

  const [formModalHero, setFormModalHero] = useState<Hero | null | undefined>(undefined);
  const [detailsHero, setDetailsHero] = useState<Hero | null>(null);

  const isFormOpen = formModalHero !== undefined;

  const renderContent = () => {
    switch (heroesState.status) {
      case 'loading':
        return <StateBox variant="loading" message="Carregando heróis..." />;

      case 'error':
        return (
          <StateBox
            variant="error"
            title="Falha de comunicação com a API"
            message={heroesState.message}
            onRetry={() => void loadHeroes()}
          />
        );

      case 'success': {
        const { data, next_cursor } = heroesState.data;
        if (data.length === 0) {
          return (
            <StateBox
              variant="empty"
              title="Nenhum herói encontrado"
              message={
                appliedSearch
                  ? `Nenhum herói corresponde à busca "${appliedSearch}".`
                  : 'Ainda não há heróis cadastrados.'
              }
            >
              {appliedSearch && (
                <button type="button" className="btn-outline" onClick={clearSearch}>
                  Limpar busca
                </button>
              )}
            </StateBox>
          );
        }

        const totalKnownPages = next_cursor ? Math.max(cursors.length, pageIdx + 2) : pageIdx + 1;

        return (
          <>
            <div className="heroes-grid">
              {data.map((hero) => {
                const isMenuOpen = openMenuHeroId === hero.id;
                return (
                  <HeroCard
                    key={hero.id}
                    hero={hero}
                    isMenuOpen={isMenuOpen}
                    onToggleMenu={() =>
                      setOpenMenuHeroId((prev) => (prev === hero.id ? null : hero.id))
                    }
                    onOpenDetails={() => setDetailsHero(hero)}
                    onEdit={() => {
                      setOpenMenuHeroId(null);
                      setFormModalHero(hero);
                    }}
                    onToggleActive={() => {
                      setOpenMenuHeroId(null);
                      openConfirm(hero.is_active ? 'deactivate' : 'activate', hero);
                    }}
                    onDelete={() => {
                      setOpenMenuHeroId(null);
                      openConfirm('delete', hero);
                    }}
                  />
                );
              })}
            </div>

            <PaginationBar
              pageIdx={pageIdx}
              totalKnownPages={totalKnownPages}
              hasNext={next_cursor !== null}
              onPageChange={setPageIdx}
              ariaLabel="Paginação de heróis"
            />
          </>
        );
      }

      default:
        return assertUnreachable(heroesState);
    }
  };

  return (
    <>
      <HeroesToolbar
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onSearchSubmit={handleSearchSubmit}
        onCreateHero={() => setFormModalHero(null)}
        onOpenCsvImport={onOpenCsvImport}
      />

      {renderContent()}

      {isFormOpen && (
        <HeroFormModal
          heroToEdit={formModalHero}
          onClose={() => setFormModalHero(undefined)}
          onSaved={(_saved, message) => {
            const wasCreate = formModalHero === null;
            setFormModalHero(undefined);
            onToast(message);
            if (wasCreate) {
              resetPagination();
              if (pageIdx === 0) void loadHeroes();
            } else {
              void loadHeroes();
            }
          }}
        />
      )}

      {detailsHero && (
        <HeroDetailsModal hero={detailsHero} onClose={() => setDetailsHero(null)} />
      )}

      {confirmModal && (
        <ConfirmModal
          title={
            confirmModal.action === 'delete'
              ? 'Excluir herói'
              : confirmModal.action === 'deactivate'
                ? 'Inativar herói'
                : 'Ativar herói'
          }
          description={
            confirmModal.action === 'delete'
              ? `Tem certeza que deseja excluir "${confirmModal.hero.nickname}"? Ele sairá da lista e da busca permanentemente.`
              : confirmModal.action === 'deactivate'
                ? `Tem certeza que deseja inativar "${confirmModal.hero.nickname}"? Ele continuará na lista, mas não poderá ser escalado em missões.`
                : `Deseja ativar novamente "${confirmModal.hero.nickname}"?`
          }
          confirmLabel={
            confirmModal.action === 'delete'
              ? 'Sim, excluir'
              : confirmModal.action === 'deactivate'
                ? 'Sim, inativar'
                : 'Sim, ativar'
          }
          tone={confirmModal.action === 'delete' ? 'danger' : 'primary'}
          isBusy={confirmBusy}
          errorMessage={confirmError}
          onConfirm={() => void handleConfirmAction()}
          onCancel={closeConfirm}
        />
      )}
    </>
  );
}
