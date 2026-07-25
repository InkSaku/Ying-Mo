import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import AuthenticatedMedia from '../common/AuthenticatedMedia.jsx'
import LivePhotoPlayer from './LivePhotoPlayer.jsx'

export default function LifePostGallery({ images, title }) {
  const staticImages = images.filter((item) => (item.media_type || 'image') !== 'live_video')
  const [index, setIndex] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const image = staticImages[index]
  const hasMultiple = staticImages.length > 1

  const previous = () => setIndex((current) => (current - 1 + staticImages.length) % staticImages.length)
  const next = () => setIndex((current) => (current + 1) % staticImages.length)

  useEffect(() => {
    if (!expanded) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'ArrowLeft' && hasMultiple) setIndex((current) => (current - 1 + staticImages.length) % staticImages.length)
      if (event.key === 'ArrowRight' && hasMultiple) setIndex((current) => (current + 1) % staticImages.length)
      if (event.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [expanded, hasMultiple, staticImages.length])

  if (!images.length) return null

  function open(item) {
    setIndex(staticImages.findIndex((candidate) => candidate.id === item.id))
    setExpanded(true)
  }

  return (
    <section className="life-gallery" aria-label={`${title} 的媒体画廊`}>
      <div className="life-gallery__flow">
        {images.map((item, itemIndex) => (
          (item.media_type || 'image') === 'live_video'
            ? <LivePhotoPlayer key={item.id} media={item} title={`${title}，第 ${itemIndex + 1} 个媒体`} eager={itemIndex === 0} />
            : (
              <button
                className="life-gallery__photo"
                key={item.id}
                type="button"
                onClick={() => open(item)}
                aria-label={`放大查看第 ${itemIndex + 1} 张照片`}
              >
                <AuthenticatedMedia
                  src={item.url}
                  alt={`${title}，第 ${itemIndex + 1} 张`}
                  fit="natural"
                  width={item.width}
                  height={item.height}
                  loading={itemIndex === 0 ? 'eager' : 'lazy'}
                />
              </button>
            )
        ))}
      </div>
      {expanded && image && createPortal(
        <div className="life-gallery__overlay" onMouseDown={(event) => event.target === event.currentTarget && setExpanded(false)}>
          <section className="life-gallery__dialog" role="dialog" aria-modal="true" aria-label={`放大图片查看，第 ${index + 1} 张，共 ${staticImages.length} 张`}>
            <div className="life-gallery__dialog-actions">
              <span aria-live="polite">{index + 1} / {staticImages.length}</span>
              <button type="button" onClick={() => setExpanded(false)} aria-label="关闭放大查看" autoFocus>关闭</button>
            </div>
            <div className="life-gallery__lightbox-media">
              <AuthenticatedMedia
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
