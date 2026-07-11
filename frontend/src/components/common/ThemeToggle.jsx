export default function ThemeToggle({ theme, onToggle }) {
  const nextLabel = theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={nextLabel}
      aria-pressed={theme === 'dark'}
      onClick={onToggle}
    >
      {theme === 'dark' ? '浅色' : '深色'}
    </button>
  )
}
