import { Children, useLayoutEffect, useRef } from 'react'

function MasonryItem({ children }) {
  const itemRef = useRef(null)

  useLayoutEffect(() => {
    const item = itemRef.current
    const content = item?.firstElementChild
    const container = item?.parentElement

    if (!item || !content || !container) return undefined

    let animationFrame = 0

    function measure() {
      const update = () => {
        const styles = window.getComputedStyle(container)
        const rowHeight = Number.parseFloat(styles.gridAutoRows)
        const rowGap = Number.parseFloat(styles.rowGap)
        const contentHeight = content.getBoundingClientRect().height

        if (!Number.isFinite(rowHeight) || rowHeight <= 0 || !Number.isFinite(contentHeight)) return

        const gap = Number.isFinite(rowGap) ? rowGap : 0
        const span = Math.max(1, Math.ceil((contentHeight + gap) / (rowHeight + gap)))
        item.style.gridRowEnd = `span ${span}`
      }

      if (typeof window.requestAnimationFrame === 'function') {
        if (animationFrame) window.cancelAnimationFrame(animationFrame)
        animationFrame = window.requestAnimationFrame(update)
      } else {
        update()
      }
    }

    measure()

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    resizeObserver?.observe(content)

    const mediaElements = content.querySelectorAll('img, video')
    mediaElements.forEach((media) => {
      media.addEventListener('load', measure)
      media.addEventListener('loadedmetadata', measure)
    })
    window.addEventListener('resize', measure)

    return () => {
      if (animationFrame && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(animationFrame)
      }
      resizeObserver?.disconnect()
      mediaElements.forEach((media) => {
        media.removeEventListener('load', measure)
        media.removeEventListener('loadedmetadata', measure)
      })
      window.removeEventListener('resize', measure)
    }
  }, [])

  return (
    <div className="masonry-feed__item" ref={itemRef} role="listitem">
      <div className="masonry-feed__content">{children}</div>
    </div>
  )
}

export default function MasonryFeed({ children, className = '', ariaLabel }) {
  const classes = ['masonry-feed', className].filter(Boolean).join(' ')

  return (
    <div className={classes} role="list" aria-label={ariaLabel}>
      {Children.toArray(children).map((child) => (
        <MasonryItem key={child.key}>{child}</MasonryItem>
      ))}
    </div>
  )
}
