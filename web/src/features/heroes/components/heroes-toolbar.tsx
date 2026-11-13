import type { FormEvent } from 'react';

export interface HeroesToolbarProps {
  readonly searchInput: string;
  readonly onSearchInputChange: (value: string) => void;
  readonly onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly onCreateHero: () => void;
  readonly onOpenCsvImport: () => void;
}

export function HeroesToolbar({
  searchInput,
  onSearchInputChange,
  onSearchSubmit,
  onCreateHero,
  onOpenCsvImport,
}: HeroesToolbarProps) {
  return (
    <form className="toolbar-row" onSubmit={onSearchSubmit}>
      <button
        type="button"
        className="btn-primary-pill"
        onClick={onCreateHero}
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
          onChange={(e) => onSearchInputChange(e.target.value)}
        />
      </div>

      <div className="toolbar-right-actions">
        <button type="submit" className="btn-white-pill">
          Buscar
        </button>
        <button
          type="button"
          className="btn-white-pill"
          onClick={onOpenCsvImport}
        >
          Importar CSV
        </button>
      </div>
    </form>
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
