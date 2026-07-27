import { useEffect, useId, useRef } from 'react'
import { lifePostDisplayTitle } from '../../utils/lifeContent.js'

function focusableElements(container) {
  return Array.from(
    container?.querySelectorAll(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) || [],
  )
}

export default function LifePostDeleteDialog({
  post,
  open,
  pending = false,
  error = null,
  onClose,
  onConfirm,
}) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef(null)
  const cancelRef = useRef(null)
  const pendingRef = useRef(pending)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    pendingRef.current = pending
  }, [pending])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return undefined
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => cancelRef.current?.focus())

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !pendingRef.current) {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const elements = focusableElements(panelRef.current)
      if (!elements.length) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [open])

  if (!open || !post) return null
  const displayTitle = lifePostDisplayTitle(post) || '这篇无标题记录'

  return (
    <div
      className="life-post-delete-dialog__backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose()
      }}
    >
      <section
        ref={panelRef}
        className="life-post-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="life-post-delete-dialog__header">
          <span className="life-post-delete-dialog__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" />
            </svg>
          </span>
          <div>
            <p>删除生活内容</p>
            <h2 id={titleId}>要和这篇记录告别吗？</h2>
          </div>
          <button
            type="button"
            className="life-post-delete-dialog__close"
            aria-label="关闭删除确认窗口"
            disabled={pending}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="life-post-delete-dialog__content">
          <p id={descriptionId}>
            删除后，这篇内容会从生活区永久移除，且无法恢复。
          </p>
          <blockquote>
            <span>即将删除</span>
            <strong>{displayTitle}</strong>
          </blockquote>
          <p className="life-post-delete-dialog__note">
            如果只是想暂时调整内容，可以先取消并返回编辑。
          </p>
          {error && (
            <p className="form-feedback form-feedback--error" role="alert">
              {error.message || '删除失败，请稍后重试。'}
            </p>
          )}
        </div>

        <footer>
          <button ref={cancelRef} type="button" disabled={pending} onClick={onClose}>
            先保留
          </button>
          <button
            type="button"
            className="life-post-delete-dialog__confirm"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? '正在删除…' : '确认删除'}
          </button>
        </footer>
      </section>
    </div>
  )
}
