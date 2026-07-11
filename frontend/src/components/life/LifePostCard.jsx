import { useState } from 'react'

export default function LifePostCard({ post, onOpen }) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <article className="life-card">
      <button className="life-card__button" type="button" onClick={(event) => onOpen(post, event.currentTarget)}>
        <span className="life-card__media">
          {!imageFailed ? (
            <img src={post.coverUrl} alt={`生活照片：${post.title}`} loading="lazy" onError={() => setImageFailed(true)} />
          ) : (
            <span className="image-placeholder">图片暂时无法显示</span>
          )}
        </span>
        <span className="life-card__body">
          <span className="life-card__meta"><span className="avatar-chip">{post.avatarText}</span>{post.author}<time dateTime={post.date}>{post.date}</time></span>
          <strong>{post.title}</strong>
          <span>{post.description}</span>
          <span className="life-card__footer"><em>{post.chapter} · {post.mood}</em><span>{post.likes} 喜欢 · {post.commentsCount} 评论</span></span>
        </span>
      </button>
    </article>
  )
}
