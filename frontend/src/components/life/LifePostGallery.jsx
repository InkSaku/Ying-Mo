import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import AdaptiveMedia from '../common/AdaptiveMedia.jsx'

export default function LifePostGallery({ images, title }) {
  const [index, setIndex] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const image = images[index]
  const hasMultiple = images.length > 1

  const previous = () => setIndex((current) => (current - 1 + images.length) % images.length)
  const next = () => setIndex((current) => (current + 1) % images.length)

  useEffect(() => {
    if (!expanded) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'ArrowLeft' && hasMultiple) setIndex((current) => (current - 1 + images.length) % images.length)
      if (event.key === 'ArrowRight' && hasMultiple) setIndex((current) => (current + 1) % images.length)
      if (event.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [expanded, hasMultiple, images.length])

  if (!images.length || !image) return null

  function open(itemIndex) {
    setIndex(itemIndex)
    setExpanded(true)
  }

  return (
    <section className="life-gallery" aria-label={`${title} 的图片画廊`}>
      <div className="life-gallery__flow">
        {images.map((item, itemIndex) => (
          <button
            className="life-gallery__photo"
            key={item.id}
            type="button"
            onClick={() => open(itemIndex)}
            aria-label={`放大查看第 ${itemIndex + 1} 张照片`}
          >
            <AdaptiveMedia
              src={item.url}
              alt={`${title}，第 ${itemIndex + 1} 张`}
              fit="natural"
              width={item.width}
              height={item.height}
              loading={itemIndex === 0 ? 'eager' : 'lazy'}
            />
          </button>
        ))}
      </div>
      {expanded && createPortal(
        <div className="life-gallery__overlay" onMouseDown={(event) => event.target === event.currentTarget && setExpanded(false)}>
          <section className="life-gallery__dialog" role="dialog" aria-modal="true" aria-label={`放大图片查看，第 ${index + 1} 张，共 ${images.length} 张`}>
            <div className="life-gallery__dialog-actions">
              <span aria-live="polite">{index + 1} / {images.length}</span>
              <button type="button" onClick={() => setExpanded(false)} aria-label="关闭放大查看" autoFocus>关闭</button>
            </div>
            <div className="life-gallery__lightbox-media">
              <AdaptiveMedia
                src={image.url}
                alt={`${title}，第 ${index + 1} 张`}
                fit="contain"
                width={image.width}
                height={image.height}
                loading="eager"
              />
            </div>
            {hasMultiple && (
              <div className="life-gallery__navigation">
                <button type="button" onClick={previous} aria-label="查看上一张照片">上一张</button>
                <button type="button" onClick={next} aria-label="查看下一张照片">下一张</button>
              </div>
            )}
          </section>
        </div>,
        document.body,
      )}
    </section>
  )
}
