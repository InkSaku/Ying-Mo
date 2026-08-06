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

function coverOrientation(post) {
  if (!post.cover_image) return 'unknown'

  const width = Number(post.cover_width)
  const height = Number(post.cover_height)

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'unknown'
  }

  const ratio = width / height
  if (ratio >= 1.25) return 'landscape'
  if (ratio <= 0.8) return 'portrait'
  return 'square'
}

export default function HomeLifePostCard({ post, featured = false, layout = 'standard' }) {
  const name = authorName(post)
  const title = post.title || post.excerpt || '生活内容'
  const excerpt = post.excerpt || ''
  const context = [post.chapter?.name, post.mood].filter(Boolean).join(' · ') || '生活记录'
  const mediaCount = Math.max(0, Number(post.media_count ?? post.image_count) || 0)
  const orientation = coverOrientation(post)
  const cardClassName = [
    'home-life-card',
    featured ? 'home-life-card--featured' : 'home-life-card--compact',
    post.cover_image ? '' : 'home-life-card--text',
    `home-life-card--${orientation}`,
    `home-life-card--layout-${layout}`,
  ].join(' ')

  return (
    <article className={cardClassName}>
      <Link
        className="home-life-card__link"
        to={`/life/post/${post.id}`}
        aria-label={`查看${name}的生活记录：${title}`}
      >
        {post.cover_image && <span className="home-life-card__media">
          {(
            <AdaptiveMedia
              src={post.cover_image}
              alt={`生活照片：${title}`}
              fit="cover"
              width={post.cover_width}
              height={post.cover_height}
              loading={featured ? 'eager' : 'lazy'}
            />
          )}
          {post.cover_media_type === 'live_video' && <span className="live-photo-badge">实况</span>}
        </span>}

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

          {post.title && <strong className="home-life-card__title">{post.title}</strong>}
          {excerpt && <span className="home-life-card__excerpt">{excerpt}</span>}

          <span className="home-life-card__footer">
            <em>{context}</em>
            {mediaCount > 0 && <span>{post.live_video_count ? `${mediaCount} 个媒体` : `${mediaCount} 张照片`}</span>}
          </span>
        </span>
      </Link>
    </article>
  )
}
