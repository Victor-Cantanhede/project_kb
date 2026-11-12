import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from './api.js';
import { ConfirmModal } from './components/ConfirmModal.js';
import { CsvImportModal } from './components/CsvImportModal.js';
import { HeroDetailsModal } from './components/HeroDetailsModal.js';
import { HeroFormModal } from './components/HeroFormModal.js';
import { MissionsView } from './components/MissionsView.js';
import { DEFAULT_HERO_AVATAR } from './format.js';
import {
  ApiClientError,
  assertUnreachable,
  updateCursorTrail,
  type AsyncState,
  type Hero,
  type Page,
} from './types.js';

type ActiveTab = 'heroes' | 'missions';

type HeroModalState =
  | { readonly kind: 'none' }
  | { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly hero: Hero }
  | { readonly kind: 'details'; readonly hero: Hero }
  | { readonly kind: 'csv_import' }
  | {
      readonly kind: 'confirm';
      readonly action: 'activate' | 'deactivate' | 'delete';
      readonly hero: Hero;
    };

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('heroes');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [cursors, setCursors] = useState<readonly (string | null)[]>([null]);
  const [pageIdx, setPageIdx] = useState(0);
  const [heroesState, setHeroesState] = useState<AsyncState<Page<Hero>>>({ status: 'loading' });

  const [openMenuHeroId, setOpenMenuHeroId] = useState<string | null>(null);
  const [modal, setModal] = useState<HeroModalState>({ kind: 'none' });
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timer = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const closeMenu = () => setOpenMenuHeroId(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const activeCursor = cursors[pageIdx] ?? null;

  const loadHeroes = useCallback(async () => {
    setHeroesState({ status: 'loading' });
    try {
      const page = await api.listHeroes({
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
      const message =
        error instanceof ApiClientError
          ? error.message
          : 'Não foi possível carregar os heróis.';
      setHeroesState({ status: 'error', message });
    }
  }, [activeCursor, appliedSearch, pageIdx]);

  useEffect(() => {
    if (activeTab === 'heroes') {
      void loadHeroes();
    }
  }, [activeTab, loadHeroes]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
    setCursors([null]);
    setPageIdx(0);
  };

  const handleConfirmAction = async (): Promise<void> => {
    if (modal.kind !== 'confirm' || confirmBusy) return;
    setConfirmBusy(true);
    setConfirmError(null);
    const { action, hero } = modal;

    try {
      switch (action) {
        case 'activate':
          await api.activateHero(hero.id);
          showToast(`Herói "${hero.nickname}" ativado.`);
          break;
        case 'deactivate':
          await api.deactivateHero(hero.id);
          showToast(`Herói "${hero.nickname}" inativado.`);
          break;
        case 'delete':
          await api.deleteHero(hero.id);
          showToast(`Herói "${hero.nickname}" excluído.`);
          break;
        default:
          assertUnreachable(action);
      }
      setModal({ kind: 'none' });
      void loadHeroes();
    } catch (error: unknown) {
      setConfirmError(
        error instanceof ApiClientError ? error.message : 'Falha ao executar a ação.',
      );
    } finally {
      setConfirmBusy(false);
    }
  };

  const renderHeroesBody = () => {
    switch (heroesState.status) {
      case 'loading':
        return (
          <div className="state-box" role="status">
            <div className="spinner" />
            <p>Carregando heróis...</p>
          </div>
        );
      case 'error':
        return (
          <div className="state-box state-box-error" role="alert">
            <h3>Falha de comunicação com a API</h3>
            <p>{heroesState.message}</p>
            <button type="button" className="btn-primary-pill" onClick={() => void loadHeroes()}>
              Tentar novamente
            </button>
          </div>
        );
      case 'success': {
        const { data, next_cursor } = heroesState.data;
        if (data.length === 0) {
          return (
            <div className="state-box">
              <h3>Nenhum herói encontrado</h3>
              <p>
                {appliedSearch
                  ? `Nenhum herói corresponde à busca "${appliedSearch}".`
                  : 'Ainda não há heróis cadastrados.'}
              </p>
              {appliedSearch && (
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => {
                    setSearchInput('');
                    setAppliedSearch('');
                    setCursors([null]);
                    setPageIdx(0);
                  }}
                >
                  Limpar busca
                </button>
              )}
            </div>
          );
        }

        const totalKnownPages = next_cursor ? Math.max(cursors.length, pageIdx + 2) : pageIdx + 1;

        return (
          <>
            <div className="heroes-grid">
              {data.map((hero) => {
                const menuOpen = openMenuHeroId === hero.id;
                return (
                  <article
                    key={hero.id}
                    className={hero.is_active ? 'hero-card' : 'hero-card hero-card-inactive'}
                    onClick={() => setModal({ kind: 'details', hero })}
                  >
                    <button
                      type="button"
                      className={menuOpen ? 'card-menu-trigger trigger-open' : 'card-menu-trigger'}
                      aria-label={`Ações para ${hero.nickname}`}
                      aria-expanded={menuOpen}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuHeroId((prev) => (prev === hero.id ? null : hero.id));
                      }}
                    >
                      ⋮
                    </button>

                    {menuOpen && (
                      <div
                        className="card-actions-popover"
                        role="menu"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className="popover-action action-delete"
                          title="Excluir"
                          aria-label={`Excluir ${hero.nickname}`}
                          onClick={() => {
                            setOpenMenuHeroId(null);
                            setConfirmError(null);
                            setModal({ kind: 'confirm', action: 'delete', hero });
                          }}
                        >
                          <TrashIcon />
                          <span className="popover-label">Excluir</span>
                        </button>

                        {hero.is_active && (
                          <button
                            type="button"
                            role="menuitem"
                            className="popover-action action-edit"
                            title="Editar"
                            aria-label={`Editar ${hero.nickname}`}
                            onClick={() => {
                              setOpenMenuHeroId(null);
                              setModal({ kind: 'edit', hero });
                            }}
                          >
                            <PencilIcon />
                            <span className="popover-label">Editar</span>
                          </button>
                        )}

                        <button
                          type="button"
                          role="menuitem"
                          className="popover-action action-toggle"
                          title={hero.is_active ? 'Inativar' : 'Ativar'}
                          aria-label={
                            hero.is_active ? `Inativar ${hero.nickname}` : `Ativar ${hero.nickname}`
                          }
                          onClick={() => {
                            setOpenMenuHeroId(null);
                            setConfirmError(null);
                            setModal({
                              kind: 'confirm',
                              action: hero.is_active ? 'deactivate' : 'activate',
                              hero,
                            });
                          }}
                        >
                          <ToggleSwitchIcon active={hero.is_active} />
                          <span className="popover-label">
                            {hero.is_active ? 'Inativar' : 'Ativar'}
                          </span>
                        </button>
                      </div>
                    )}

                    <div className="hero-avatar-wrapper">
                      <img
                        src={hero.avatar_url ?? DEFAULT_HERO_AVATAR}
                        alt={hero.nickname}
                        className="hero-avatar-img"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_HERO_AVATAR;
                        }}
                      />
                    </div>

                    <h2 className="hero-card-name" title={hero.nickname}>
                      {hero.nickname}
                    </h2>
                    {!hero.is_active && <span className="inactive-badge">Inativo</span>}
                  </article>
                );
              })}
            </div>

            <nav className="pagination-bar" aria-label="Paginação de heróis">
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
        return assertUnreachable(heroesState);
    }
  };

  return (
    <div className="app-shell">
      <header className="top-header">
        <h1 className="page-heading">{activeTab === 'heroes' ? 'Heróis' : 'Missões'}</h1>
        <nav className="main-tabs" aria-label="Navegação principal">
          <button
            type="button"
            className={activeTab === 'heroes' ? 'tab-btn tab-btn-active' : 'tab-btn'}
            onClick={() => setActiveTab('heroes')}
          >
            Heróis
          </button>
          <button
            type="button"
            className={activeTab === 'missions' ? 'tab-btn tab-btn-active' : 'tab-btn'}
            onClick={() => setActiveTab('missions')}
          >
            Missões
          </button>
        </nav>
      </header>

      {toastMessage && (
        <div className="toast-banner" role="status">
          <span>{toastMessage}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setToastMessage(null)}
            aria-label="Fechar aviso"
          >
            ✕
          </button>
        </div>
      )}

      <main className="main-container">
        {activeTab === 'heroes' ? (
          <>
            <form className="toolbar-row" onSubmit={handleSearchSubmit}>
              <button
                type="button"
                className="btn-primary-pill"
                onClick={() => setModal({ kind: 'create' })}
              >
                Criar
              </button>

              <div className="search-box">
                <SearchIcon />
                <input
                  type="search"
                  className="search-input"
                  placeholder="Digite o nome do herói"
                  aria-label="Buscar herói por nome ou nome de guerra"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>

              <div className="toolbar-right-actions">
                <button type="submit" className="btn-white-pill">
                  Buscar
                </button>
                <button
                  type="button"
                  className="btn-white-pill"
                  onClick={() => setModal({ kind: 'csv_import' })}
                >
                  Importar CSV
                </button>
              </div>
            </form>

            {renderHeroesBody()}
          </>
        ) : (
          <MissionsView onToast={showToast} />
        )}
      </main>

      {(modal.kind === 'create' || modal.kind === 'edit') && (
        <HeroFormModal
          heroToEdit={modal.kind === 'edit' ? modal.hero : null}
          onClose={() => setModal({ kind: 'none' })}
          onSaved={(_saved, message) => {
            const wasCreate = modal.kind === 'create';
            setModal({ kind: 'none' });
            showToast(message);
            if (wasCreate) {
              setCursors([null]);
              setPageIdx(0);
              if (pageIdx === 0) void loadHeroes();
            } else {
              void loadHeroes();
            }
          }}
        />
      )}

      {modal.kind === 'details' && (
        <HeroDetailsModal hero={modal.hero} onClose={() => setModal({ kind: 'none' })} />
      )}

      {modal.kind === 'csv_import' && (
        <CsvImportModal
          onClose={() => setModal({ kind: 'none' })}
          onImportCompleted={() => {
            showToast('Importação de CSV concluída!');
            setCursors([null]);
            setPageIdx(0);
            if (pageIdx === 0) void loadHeroes();
          }}
        />
      )}

      {modal.kind === 'confirm' && (
        <ConfirmModal
          title={
            modal.action === 'delete'
              ? 'Excluir herói'
              : modal.action === 'deactivate'
                ? 'Inativar herói'
                : 'Ativar herói'
          }
          description={
            modal.action === 'delete'
              ? `Tem certeza que deseja excluir "${modal.hero.nickname}"? Ele sairá da lista e da busca permanentemente.`
              : modal.action === 'deactivate'
                ? `Tem certeza que deseja inativar "${modal.hero.nickname}"? Ele continuará na lista, mas não poderá ser escalado em missões.`
                : `Deseja ativar novamente "${modal.hero.nickname}"?`
          }
          confirmLabel={
            modal.action === 'delete'
              ? 'Sim, excluir'
              : modal.action === 'deactivate'
                ? 'Sim, inativar'
                : 'Sim, ativar'
          }
          tone={modal.action === 'delete' ? 'danger' : 'primary'}
          isBusy={confirmBusy}
          errorMessage={confirmError}
          onConfirm={() => void handleConfirmAction()}
          onCancel={() => setModal({ kind: 'none' })}
        />
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#003399" strokeWidth="2">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      <line x1="2" y1="23" x2="22" y2="23" />
    </svg>
  );
}

function ToggleSwitchIcon({ active }: { readonly active: boolean }) {
  return (
    <svg width="36" height="20" viewBox="0 0 36 20" fill="none">
      <rect
        x="1"
        y="1"
        width="34"
        height="18"
        rx="9"
        fill={active ? '#3F62C8' : '#9CA3AF'}
      />
      <circle cx={active ? '25' : '11'} cy="10" r="6.5" fill="#FFFFFF" />
    </svg>
  );
}

