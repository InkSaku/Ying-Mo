import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function LifePostGallery({ images, title }) {
  const [index, setIndex] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const image = images[index]
  const hasMultiple = images.length > 1

  const previous = () => setIndex((current) => (current - 1 + images.length) % images.length)
  const next = () => setIndex((current) => (current + 1) % images.length)

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'ArrowLeft' && hasMultiple) setIndex((current) => (current - 1 + images.length) % images.length)
      if (event.key === 'ArrowRight' && hasMultiple) setIndex((current) => (current + 1) % images.length)
      if (event.key === 'Escape' && expanded) setExpanded(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [expanded, hasMultiple, images.length])

  if (!image) return null

  const viewer = (
    <div className="life-gallery__viewer">
      <button className="life-gallery__main" type="button" onClick={() => setExpanded(true)} aria-label="放大查看当前照片">
        <img src={image.url} alt={`${title}，第 ${index + 1} 张`} />
      </button>
      {hasMultiple && (
        <>
          <button className="life-gallery__previous" type="button" onClick={previous} aria-label="查看上一张照片">上一张</button>
          <button className="life-gallery__next" type="button" onClick={next} aria-label="查看下一张照片">下一张</button>
          <span className="life-gallery__count">{index + 1} / {images.length}</span>
        </>
      )}
    </div>
  )

  return (
    <section className="life-gallery" aria-label={`${title} 的图片画廊`}>
      {viewer}
      {hasMultiple && (
        <div className="life-gallery__thumbs" role="tablist" aria-label="选择照片">
          {images.map((item, itemIndex) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={itemIndex === index}
              className={itemIndex === index ? 'is-current' : ''}
              onClick={() => setIndex(itemIndex)}
            >
              <img src={item.thumbnail_url} alt={`切换到第 ${itemIndex + 1} 张`} />
            </button>
          ))}
        </div>
      )}
      {expanded && createPortal(
        <div className="life-gallery__overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setExpanded(false)}>
          <section className="life-gallery__dialog" role="dialog" aria-modal="true" aria-label="放大图片查看">
            <button type="button" onClick={() => setExpanded(false)} aria-label="关闭放大查看">关闭</button>
            {viewer}
          </section>
        </div>,
        document.body,
      )}
    </section>
  )
}
