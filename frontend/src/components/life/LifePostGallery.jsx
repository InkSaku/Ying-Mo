import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import AuthenticatedMedia from '../common/AuthenticatedMedia.jsx'
import LivePhotoPlayer from './LivePhotoPlayer.jsx'

function isLivePhoto(item) {
  return (item?.media_type || 'image') === 'live_video'
}

function uniqueMedia(cover, images) {
  const seen = new Set()
  return [cover, ...images].filter((item) => {
    if (!item) return false
    const key = item.id ?? item.public_id ?? item.url
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export default function LifePostGallery({ images = [], cover = null, title }) {
  const reducedMotion = useReducedMotion()
  const media = uniqueMedia(cover, images)
  const staticImages = media.filter((item) => !isLivePhoto(item))
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [expanded, setExpanded] = useState(false)
  const activeTriggerRef = useRef(null)
  const swipeStartRef = useRef(null)
  const image = staticImages[index]
  const hasMultiple = staticImages.length > 1

  useEffect(() => {
    if (!expanded) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event) => {
      if (event.key === 'ArrowLeft' && hasMultiple) {
        event.preventDefault()
        setDirection(-1)
        setIndex((current) => (current - 1 + staticImages.length) % staticImages.length)
      }
      if (event.key === 'ArrowRight' && hasMultiple) {
        event.preventDefault()
        setDirection(1)
        setIndex((current) => (current + 1) % staticImages.length)
      }
      if (event.key === 'Escape') setExpanded(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      window.setTimeout(() => activeTriggerRef.current?.focus(), 0)
    }
  }, [expanded, hasMultiple, staticImages.length])

  if (!media.length) return null

  function open(item, trigger) {
    const nextIndex = staticImages.findIndex((candidate) => candidate.id === item.id)
    if (nextIndex < 0) return
    activeTriggerRef.current = trigger
    setDirection(nextIndex >= index ? 1 : -1)
    setIndex(nextIndex)
    setExpanded(true)
  }

  function select(nextIndex) {
    setDirection(nextIndex >= index ? 1 : -1)
    setIndex(nextIndex)
  }

  function previous() {
    setDirection(-1)
    setIndex((current) => (current - 1 + staticImages.length) % staticImages.length)
  }

  function next() {
    setDirection(1)
    setIndex((current) => (current + 1) % staticImages.length)
  }

  function finishSwipe(event) {
    if (!hasMultiple || swipeStartRef.current === null) return
    const distance = event.clientX - swipeStartRef.current
    swipeStartRef.current = null
    if (Math.abs(distance) < 48) return
    if (distance > 0) previous()
    else next()
  }

  function staticPhoto(item, label, featured = false, key = undefined) {
    return (
      <button
        key={key}
        className={featured ? 'life-gallery__featured-photo' : 'life-gallery__photo'}
        type="button"
        onClick={(event) => open(item, event.currentTarget)}
        aria-label={featured ? `放大查看${title}的封面` : `放大查看${label}`}
      >
        <AuthenticatedMedia
          src={featured ? item.url : (item.url || item.thumbnail_url)}
          alt={featured ? `${title}的封面` : label}
          fit="natural"
          width={item.width}
          height={item.height}
          loading={featured ? 'eager' : 'lazy'}
        />
        <span className="life-gallery__zoom-hint" aria-hidden="true">查看大图</span>
      </button>
    )
  }

  const viewer = createPortal(
    <AnimatePresence>
      {expanded && image && (
        <motion.div
          className="life-gallery__overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.18 }}
          onMouseDown={(event) => event.target === event.currentTarget && setExpanded(false)}
        >
          <motion.section
            className="life-gallery__dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`放大图片查看，第 ${index + 1} 张，共 ${staticImages.length} 张`}
            initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: reducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="life-gallery__dialog-actions">
              <div>
                <span aria-live="polite">{index + 1} / {staticImages.length}</span>
                {hasMultiple && <small>方向键或滑动切换</small>}
              </div>
              <button type="button" onClick={() => setExpanded(false)} aria-label="关闭放大查看" autoFocus>
                关闭
              </button>
            </div>

            <div
              className="life-gallery__viewer"
              onPointerDown={(event) => { swipeStartRef.current = event.clientX }}
              onPointerUp={finishSwipe}
              onPointerCancel={() => { swipeStartRef.current = null }}
            >
              {hasMultiple && (
                <button className="life-gallery__viewer-arrow life-gallery__viewer-arrow--previous" type="button" onClick={previous} aria-label="查看上一张照片">
                  ←
                </button>
              )}
              <div className="life-gallery__lightbox-media">
                <AnimatePresence initial={false} mode="popLayout" custom={direction}>
                  <motion.div
                    className="life-gallery__lightbox-slide"
                    key={image.id ?? image.public_id ?? image.url}
                    initial={reducedMotion ? false : { opacity: 0, x: direction * 28, scale: 0.99 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={reducedMotion ? undefined : { opacity: 0, x: direction * -22, scale: 0.995 }}
                    transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <AuthenticatedMedia
                      src={image.url}
                      alt={`${title}，第 ${index + 1} 张`}
                      fit="contain"
                      width={image.width}
                      height={image.height}
                      loading="eager"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
              {hasMultiple && (
                <button className="life-gallery__viewer-arrow life-gallery__viewer-arrow--next" type="button" onClick={next} aria-label="查看下一张照片">
                  →
                </button>
              )}
            </div>

            {hasMultiple && (
              <div className="life-gallery__thumbnails" aria-label="选择要查看的照片">
                {staticImages.map((item, itemIndex) => (
                  <button
                    key={item.id ?? item.public_id ?? item.url}
                    className={itemIndex === index ? 'is-current' : ''}
                    type="button"
                    aria-label={`查看第 ${itemIndex + 1} 张照片`}
                    aria-current={itemIndex === index ? 'true' : undefined}
                    onClick={() => select(itemIndex)}
                  >
                    <AuthenticatedMedia
                      src={item.thumbnail_url || item.url}
                      alt=""
                      fit="cover"
                      width={item.width}
                      height={item.height}
                    />
                    <span>{itemIndex + 1}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )

  return (
    <section className="life-gallery" aria-label={`${title} 的媒体画廊`}>
      {cover && (
        <figure className="life-post-cover">
          {isLivePhoto(cover)
            ? <LivePhotoPlayer media={cover} title={`${title}的封面`} eager />
            : staticPhoto(cover, `${title}的封面`, true)}
        </figure>
      )}

      {images.length > 0 && (
        <div className="life-gallery__flow">
          {images.map((item, itemIndex) => (
            isLivePhoto(item)
              ? <LivePhotoPlayer key={item.id} media={item} title={`${title}，第 ${itemIndex + 1} 个媒体`} eager={!cover && itemIndex === 0} />
              : staticPhoto(item, `${title}，第 ${itemIndex + 1} 张`, false, item.id)
          ))}
        </div>
      )}
      {viewer}
    </section>
  )
}
