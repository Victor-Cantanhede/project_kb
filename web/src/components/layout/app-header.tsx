export type ActiveTab = 'heroes' | 'missions';

export interface AppHeaderProps {
  readonly activeTab: ActiveTab;
  readonly onTabChange: (tab: ActiveTab) => void;
}

export function AppHeader({ activeTab, onTabChange }: AppHeaderProps) {
  return (
    <header className="top-header">
      <h1 className="page-heading">{activeTab === 'heroes' ? 'Heróis' : 'Missões'}</h1>
      <nav className="main-tabs" aria-label="Navegação principal">
        <button
          type="button"
          className={activeTab === 'heroes' ? 'tab-btn tab-btn-active' : 'tab-btn'}
          onClick={() => onTabChange('heroes')}
        >
          Heróis
        </button>
        <button
          type="button"
          className={activeTab === 'missions' ? 'tab-btn tab-btn-active' : 'tab-btn'}
          onClick={() => onTabChange('missions')}
        >
          Missões
        </button>
      </nav>
    </header>
  );
}
