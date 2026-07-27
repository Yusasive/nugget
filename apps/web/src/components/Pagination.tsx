import { getPageTokens } from '../lib/pagination-range';

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (total === 0) return null;

  const tokens = getPageTokens(page, totalPages);

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="muted">
        Page {page} of {totalPages} · {total} total
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="page-btn"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ‹
        </button>
        {tokens.map((token) =>
          typeof token === 'number' ? (
            <button
              key={token}
              type="button"
              className={`page-btn${token === page ? ' active' : ''}`}
              aria-label={`Page ${token}`}
              aria-current={token === page ? 'page' : undefined}
              onClick={() => onPageChange(token)}
            >
              {token}
            </button>
          ) : (
            <span key={token} className="page-ellipsis" aria-hidden="true">
              …
            </span>
          ),
        )}
        <button
          type="button"
          className="page-btn"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          ›
        </button>
      </div>
    </nav>
  );
}
