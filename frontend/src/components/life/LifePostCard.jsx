import { Link } from 'react-router-dom'
import { isLongLifePost, lifePostDisplayTitle, plainTextSummary } from '../../utils/lifeContent.js'
import AuthenticatedMedia from '../common/AuthenticatedMedia.jsx'

export default function LifePostCard({ post, className = '' }) {
  const title = lifePostDisplayTitle(post)
  const excerpt = plainTextSummary(post.excerpt || '', post.content_format === 'markdown' ? 180 : 220)
  const longform = isLongLifePost(post)
  const hasMedia = Boolean(post.cover_image)
  const videoOnly = post.has_external_video && !hasMedia
  const variant = hasMedia ? 'media' : videoOnly ? 'video' : longform ? 'longform' : 'text'
  const mediaCount = post.media_count ?? post.image_count ?? 0

  return (
    <article className={['life-card', `life-card--${variant}`, className].filter(Boolean).join(' ')}>
      <Link className="life-card__button" to={`/life/post/${post.id}`} aria-label={`查看${title || '这条生活内容'}`}>
        {hasMedia && (
          <span className="life-card__media">
            <AuthenticatedMedia src={post.cover_image} alt={post.title ? `生活照片：${post.title}` : '生活内容封面'} fit="natural" width={post.cover_width} height={post.cover_height} />
            {post.cover_media_type === 'live_video' && <span className="live-photo-badge">实况</span>}
            {post.has_external_video && <span className="life-video-badge">视频链接</span>}
          </span>
        )}
        {videoOnly && (
          <span className="life-card__video-placeholder" aria-hidden="true">
            <span>▶</span>
            <small>外部视频</small>
          </span>
        )}
        <span className="life-card__body">
          <span className="life-card__meta"><span className="avatar-chip">{post.author.nickname.slice(0, 1)}</span>{post.author.nickname}<time dateTime={post.created_at}>{new Date(post.created_at).toLocaleDateString('zh-CN')}</time></span>
          {post.title && <strong>{post.title}</strong>}
          {excerpt && <span className="life-card__excerpt">{excerpt}</span>}
          {longform && <span className="life-card__read-more">阅读全文 →</span>}
          <span className="life-card__footer">
            <em>{post.chapter.name}{post.mood ? ` · ${post.mood}` : ''}</em>
            <span className="life-card__engagement" aria-label={`点赞 ${post.like_count || 0}，评论 ${post.comment_count || 0}`}>
              <span>♡ {post.like_count || 0}</span>
              <span>评论 {post.comment_count || 0}</span>
            </span>
          </span>
          <span className="life-card__content-kind">{post.has_external_video ? '含视频' : mediaCount ? (post.live_video_count ? `${mediaCount} 个媒体` : `${mediaCount} 张照片`) : '文字记录'}</span>
        </span>
      </Link>
    </article>
  )
}
