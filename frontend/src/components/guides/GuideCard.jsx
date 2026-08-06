import { Link } from 'react-router-dom'
import AdaptiveMedia from '../common/AdaptiveMedia.jsx'
import { categoryLabels, validityLabels } from './guideLabels.js'

function sideLabel(side) {
  return side === 'attack' ? '进攻方' : side === 'defense' ? '防守方' : side === 'both' ? '攻防皆可' : ''
}

export default function GuideCard({ guide, className = '', variant = '' }) {
  return <article className={['guide-card', `guide-card--${guide.validity_status}`, variant && `guide-card--${variant}`, className].filter(Boolean).join(' ')}>
    <Link to={`/guide/${guide.id}`}>
      <div className="guide-card__media">{guide.cover_image ? <AdaptiveMedia src={guide.cover_image} alt={`${guide.title}封面`} fit={variant === 'lookup' ? 'cover' : 'natural'} width={guide.cover_width} height={guide.cover_height} /> : <span className="guide-card__placeholder" role="img" aria-label={`${guide.title}暂无图片`}>映</span>}</div>
      <div className="guide-card__body">
        <p className="eyebrow">{categoryLabels[guide.category] || guide.category}</p>
        <h3>{guide.title}</h3>
        <p className="guide-card__context">{guide.map?.name_zh} · {guide.hero?.name_zh}</p>
        <div className="guide-card__facts">
          {guide.map_area && <span>{guide.map_area}</span>}
          {guide.side && <span>{sideLabel(guide.side)}</span>}
          {guide.timing && <span>时机：{guide.timing}</span>}
        </div>
        <p className={`guide-validity guide-validity--${guide.validity_status}`}>{validityLabels[guide.validity_status] || guide.validity_status}</p>
        <p className="guide-card__excerpt">{guide.excerpt}</p>
        <footer className="guide-card__footer">
          <span>{guide.author.nickname} · 更新于 {new Date(guide.updated_at).toLocaleDateString('zh-CN')}</span>
          <span>赞 {guide.like_count || 0} · 收藏 {guide.favorite_count || 0}</span>
        </footer>
      </div>
    </Link>
  </article>
}
