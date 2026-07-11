import { Link } from 'react-router-dom'

export default function LifePostCard({ post }) {
  return (
    <article className="life-card">
      <Link className="life-card__button" to={`/life/post/${post.id}`}>
        <span className="life-card__media">
          {post.cover_image ? <img src={post.cover_image} alt={`生活照片：${post.title}`} loading="lazy" /> : <span className="image-placeholder">尚未找到封面</span>}
        </span>
        <span className="life-card__body">
          <span className="life-card__meta"><span className="avatar-chip">{post.author.nickname.slice(0, 1)}</span>{post.author.nickname}<time dateTime={post.created_at}>{new Date(post.created_at).toLocaleDateString('zh-CN')}</time></span>
          <strong>{post.title}</strong>
          <span>{post.excerpt || '把这一天留在这里。'}</span>
          <span className="life-card__footer"><em>{post.chapter.name}{post.mood ? ` · ${post.mood}` : ''}</em><span>{post.image_count} 张照片</span></span>
        </span>
      </Link>
    </article>
  )
}
