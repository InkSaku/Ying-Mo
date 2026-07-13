export default function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.total_pages <= 1) return null

  const pages = Array.from(
    { length: Math.min(pagination.total_pages, 7) },
    (_, index) => Math.max(1, Math.min(pagination.total_pages - 6, pagination.page - 3)) + index,
  )

  return (
    <nav className="life-pagination" aria-label="分页">
      <button type="button" onClick={() => onPageChange(pagination.page - 1)} disabled={!pagination.has_previous}>
        上一页
      </button>
      {pages.map((page) => (
        <button
          key={page}
          type="button"
          className={page === pagination.page ? 'is-current' : ''}
          aria-current={page === pagination.page ? 'page' : undefined}
          onClick={() => onPageChange(page)}
        >
          {page}
        </button>
      ))}
      <button type="button" onClick={() => onPageChange(pagination.page + 1)} disabled={!pagination.has_next}>
        下一页
      </button>
    </nav>
  )
}
