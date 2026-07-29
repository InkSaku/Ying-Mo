export default function ImmersiveShell({ children, className = '' }) {
  function trackPointer(event) {
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') {
      return
    }

    event.currentTarget.style.setProperty('--ambient-x', `${event.clientX}px`)
    event.currentTarget.style.setProperty('--ambient-y', `${event.clientY}px`)
  }

  return (
    <div className={`app-shell${className ? ` ${className}` : ''}`} onPointerMove={trackPointer}>
      <div className="immersive-ambient" aria-hidden="true" />
      {children}
    </div>
  )
}
