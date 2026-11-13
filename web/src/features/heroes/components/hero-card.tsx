import type { Hero } from '../types/heroes.types.js';
import { DEFAULT_HERO_AVATAR } from '../utils/hero-formatters.js';

export interface HeroCardProps {
  readonly hero: Hero;
  readonly isMenuOpen: boolean;
  readonly onToggleMenu: (event: React.MouseEvent) => void;
  readonly onOpenDetails: () => void;
  readonly onEdit: () => void;
  readonly onToggleActive: () => void;
  readonly onDelete: () => void;
}

export function HeroCard({
  hero,
  isMenuOpen,
  onToggleMenu,
  onOpenDetails,
  onEdit,
  onToggleActive,
  onDelete,
}: HeroCardProps) {
  return (
    <article
      className={hero.is_active ? 'hero-card' : 'hero-card hero-card-inactive'}
      onClick={onOpenDetails}
    >
      <button
        type="button"
        className={isMenuOpen ? 'card-menu-trigger trigger-open' : 'card-menu-trigger'}
        aria-label={`Ações para ${hero.nickname}`}
        aria-expanded={isMenuOpen}
        onClick={(e) => {
          e.stopPropagation();
          onToggleMenu(e);
        }}
      >
        ⋮
      </button>

      {isMenuOpen && (
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
            onClick={onDelete}
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
              onClick={onEdit}
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
            aria-label={hero.is_active ? `Inativar ${hero.nickname}` : `Ativar ${hero.nickname}`}
            onClick={onToggleActive}
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
