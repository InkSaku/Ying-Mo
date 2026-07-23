import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import AdaptiveMedia from '../common/AdaptiveMedia.jsx'

const categoryLabels = {
  deployment_position: '炮台与部署点位', skill_throw: '技能投掷', timed_throw: '开局定时投掷', hold_position: '架枪与站位', movement_route: '位移与路线', map_interaction: '地图机制与交互', other: '其他点位',
}

const validityLabels = {
  valid: '当前有效',
  invalid: '已失效',
  unverified: '未验证',
  possibly_invalid: '可能失效',
}

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

function formatDate(value) {
  return value ? dateFormatter.format(new Date(value)) : '时间未标注'
}

function cardMotion(index, reducedMotion) {
  return {
    initial: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    whileHover: reducedMotion ? undefined : { y: -2 },
    whileTap: reducedMotion ? undefined : { scale: 0.988 },
    transition: {
      duration: 0.28,
      delay: reducedMotion ? 0 : Math.min(index * 0.04, 0.16),
      ease: [0.22, 1, 0.36, 1],
    },
  }
}

export function ProfileLifeCard({ post, index, reducedMotion }) {
  return (
    <motion.article className="profile-life-card" {...cardMotion(index, reducedMotion)}>
      <Link to={`/life/post/${post.id}`}>
        <span className="profile-life-card__media">
          {post.cover_image ? (
            <AdaptiveMedia src={post.cover_image} alt={`生活照片：${post.title}`} fit="cover" />
          ) : (
            <span className="profile-card-placeholder" aria-hidden="true">日</span>
          )}
          <span className="profile-life-card__count">{post.image_count} 张</span>
        </span>

        <span className="profile-life-card__body">
          <span className="profile-life-card__topline">
            <span>{post.chapter?.name || '未归档章节'}</span>
            <time dateTime={post.created_at}>{formatDate(post.created_at)}</time>
          </span>
          <strong>{post.title}</strong>
          <span className="profile-life-card__excerpt">{post.excerpt || '把这一天留在这里。'}</span>
          <span className="profile-life-card__footer">
            <span>{post.mood || '普通的一天'}</span>
            <span aria-hidden="true">→</span>
          </span>
        </span>
      </Link>
    </motion.article>
  )
}

export function ProfileGuideCard({ guide, index, reducedMotion }) {
  const gameLine = [guide.hero?.name_zh, guide.map?.name_zh].filter(Boolean).join(' · ')

  return (
    <motion.article className="profile-guide-card" {...cardMotion(index, reducedMotion)}>
      <Link to={`/guide/${guide.id}`}>
        <span className="profile-guide-card__media">
          {guide.cover_image ? (
            <img src={guide.cover_image} alt={`${guide.title} 封面步骤`} loading="lazy" />
          ) : (
            <span className="profile-card-placeholder profile-card-placeholder--game" aria-hidden="true">技</span>
          )}
          <span className="profile-guide-card__steps">{guide.step_count} 步</span>
        </span>

        <span className="profile-guide-card__body">
          <span className="profile-guide-card__topline">
            <span>{guide.game?.name_zh || '游戏教材'}</span>
            <em data-status={guide.validity_status || 'unverified'}>
              {validityLabels[guide.validity_status] || '未验证'}
            </em>
          </span>
          <strong>{guide.title}</strong>
          <span className="profile-guide-card__excerpt">{guide.excerpt || '这篇教材还没有补充摘要。'}</span>
          <span className="profile-guide-card__meta">
            <span>{categoryLabels[guide.category] || guide.category || '其他技巧'}</span>
            <span>{gameLine || guide.game_version || '范围未标注'}</span>
          </span>
          <span className="profile-guide-card__footer">
            <span>{guide.game_version || '版本未标注'}</span>
            <span aria-hidden="true">→</span>
          </span>
        </span>
      </Link>
    </motion.article>
  )
}
