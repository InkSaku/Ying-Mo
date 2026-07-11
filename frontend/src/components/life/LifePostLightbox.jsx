import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function LifePostLightbox({ post, onClose }) {
  const closeButtonRef = useRef(null)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return

      const dialog = closeButtonRef.current?.closest('[role="dialog"]')
      const focusable = dialog?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
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
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return createPortal(
    <div className="lightbox" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="lightbox__dialog" role="dialog" aria-modal="true" aria-labelledby="life-lightbox-title">
        <button ref={closeButtonRef} className="lightbox__close" type="button" aria-label="关闭照片详情" onClick={onClose}>关闭</button>
        <div className="lightbox__media">
          {!imageFailed ? (
            <img src={post.coverUrl} alt={`生活照片：${post.title}`} onError={() => setImageFailed(true)} />
          ) : (
            <div className="image-placeholder">图片暂时无法显示</div>
          )}
        </div>
        <div className="lightbox__content">
          <p className="eyebrow">{post.chapter}</p>
          <h2 id="life-lightbox-title">{post.title}</h2>
          <p>{post.description}</p>
          <dl className="lightbox__meta">
            <div><dt>作者</dt><dd>{post.author}</dd></div>
            <div><dt>时间</dt><dd>{post.date}</dd></div>
            <div><dt>地点</dt><dd>{post.location}</dd></div>
            <div><dt>心情</dt><dd>{post.mood}</dd></div>
            <div><dt>互动</dt><dd>{post.likes} 喜欢 · {post.commentsCount} 评论</dd></div>
          </dl>
          <div className="tag-row">{post.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          <section className="mock-comments" aria-label="评论预览">
            <h3>评论预览</h3>
            {post.comments.map((comment) => (
              <article key={comment.id}><strong>{comment.author}</strong><p>{comment.content}</p></article>
            ))}
          </section>
        </div>
      </section>
    </div>,
    document.body,
  )
}
