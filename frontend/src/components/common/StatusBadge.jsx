export default function StatusBadge({ children, tone = 'default' }) {
  return <span className={`status-badge status-badge--${tone}`}>{children}</span>
}
