import { Link } from 'react-router-dom'
import AdaptiveMedia from '../common/AdaptiveMedia.jsx'

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '时间未记录' : dateFormatter.format(date)
}

function authorName(post) {
  return post.author?.nickname || post.author?.username || '一位记录者'
}

export default function HomeLifePostCard({ post, featured = false }) {
  const name = authorName(post)
  const title = post.title || '没有标题的日常'
  const excerpt = post.excerpt || '把这一天留在这里。'
  const context = [post.chapter?.name, post.mood].filter(Boolean).join(' · ') || '生活记录'
  const imageCount = Math.max(0, Number(post.image_count) || 0)

  return (
    <article className={`home-life-card ${featured ? 'home-life-card--featured' : 'home-life-card--compact'}`}>
      <Link
        className="home-life-card__link"
        to={`/life/post/${post.id}`}
        aria-label={`查看${name}的生活记录：${title}`}
      >
        <span className="home-life-card__media">
          {post.cover_image ? (
            <AdaptiveMedia
              src={post.cover_image}
              alt={`生活照片：${title}`}
              fit="cover"
              loading={featured ? 'eager' : 'lazy'}
            />
          ) : (
            <span className="home-life-card__placeholder">这一刻还没有封面</span>
          )}

          {imageCount > 0 && (
            <span className="home-life-card__image-count">
              {imageCount} 张照片
            </span>
          )}
        </span>

        <span className="home-life-card__body">
          <span className="home-life-card__meta">
            <span className="home-life-card__author">
              {post.author?.avatar_url ? (
                <img src={post.author.avatar_url} alt="" loading="lazy" />
              ) : (
                <span aria-hidden="true">{name.slice(0, 1)}</span>
              )}
              <b>{name}</b>
            </span>
            <time dateTime={post.created_at || undefined}>{formatDate(post.created_at)}</time>
          </span>

          <strong className="home-life-card__title">{title}</strong>
          <span className="home-life-card__excerpt">{excerpt}</span>

          <span className="home-life-card__footer">
            <em>{context}</em>
            <span className="home-life-card__open">
              打开记录 <span aria-hidden="true">→</span>
            </span>
          </span>
        </span>
      </Link>
    </article>
  )
}
