export interface PaginationBarProps {
  readonly pageIdx: number;
  readonly totalKnownPages: number;
  readonly hasNext: boolean;
  readonly onPageChange: (pageIdx: number) => void;
  readonly ariaLabel?: string;
}

export function PaginationBar({
  pageIdx,
  totalKnownPages,
  hasNext,
  onPageChange,
  ariaLabel = 'Paginação',
}: PaginationBarProps) {
  return (
    <nav className="pagination-bar" aria-label={ariaLabel}>
      <button
        type="button"
        className="page-arrow"
        disabled={pageIdx === 0}
        onClick={() => onPageChange(Math.max(0, pageIdx - 1))}
        aria-label="Página anterior"
      >
        ‹
      </button>

      {Array.from({ length: totalKnownPages }, (_, idx) => (
        <button
          key={idx}
          type="button"
          className={idx === pageIdx ? 'page-num page-num-active' : 'page-num'}
          onClick={() => onPageChange(idx)}
        >
          {idx + 1}
        </button>
      ))}

      <button
        type="button"
        className="page-arrow"
        disabled={!hasNext}
        onClick={() => onPageChange(pageIdx + 1)}
        aria-label="Próxima página"
      >
        ›
      </button>
    </nav>
  );
}
