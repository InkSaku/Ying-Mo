import { Link } from 'react-router-dom'

export function CatalogPlaceholder({ label, compact = false }) {
  return <span className={`catalog-placeholder ${compact ? 'catalog-placeholder--compact' : ''}`} role="img" aria-label={`${label}暂无图片`}><span aria-hidden="true">映</span><small>暂无图片</small></span>
}

export function GameCard({ game }) {
  const cover = game.cover_thumbnail_url || game.cover_url
  const icon = game.icon_thumbnail_url || game.icon_url
  return <article className="game-card game-card--directory">
    <div className="game-card__media">{cover ? <img src={cover} alt={`${game.name_zh}封面`} loading="lazy" /> : <CatalogPlaceholder label={game.name_zh} />}</div>
    <div className="game-card__body">
      <header className="game-card__heading">
        <span className="game-card__icon">{icon ? <img src={icon} alt="" loading="lazy" /> : <CatalogPlaceholder label={game.name_zh} compact />}</span>
        <span><h3>{game.name_zh}</h3>{game.name_en && <span className="game-card__english">{game.name_en}</span>}</span>
      </header>
      <p className="game-card__description">{game.description || '等待管理员补充这款游戏的简介。'}</p>
      <p className="game-card__version">{game.current_version || '当前版本未标注'}</p>
      <div className="game-card__stats" aria-label="目录统计">
        <span><strong>{game.usable_map_count ?? game.map_count ?? 0}</strong> 张地图</span>
        <span><strong>{game.active_hero_count ?? game.hero_count ?? 0}</strong> 位英雄</span>
        <span><strong>{game.guide_count ?? 0}</strong> 个点位</span>
      </div>
      <Link className="button button--primary game-card__action" to={`/game/${game.slug}/maps`}>进入地图目录</Link>
    </div>
  </article>
}
export function HeroCard({ hero }) {
  return <article className="catalog-card"><Link to={`/game/${hero.game.slug}/hero/${hero.slug}`}><div className="catalog-card__media">{hero.avatar_thumbnail_url ? <img src={hero.avatar_thumbnail_url} alt={`${hero.name_zh} 头像`} loading="lazy" /> : <CatalogPlaceholder label={hero.name_zh} />}</div><div><p className="eyebrow">{hero.role || '未标注定位'}</p><h3>{hero.name_zh}</h3>{hero.name_en && <p className="game-card__english">{hero.name_en}</p>}<p>{hero.description || '暂无英雄说明。'}</p></div></Link></article>
}
export function MapCard({ map }) {
  const status = ({ active: '当前可用', rotated_out: '暂时轮换外', retired: '已退役' })[map.current_status] || map.current_status
  return <article className={`catalog-card catalog-card--map catalog-card--${map.current_status}`}><Link to={`/game/${map.game.slug}/map/${map.slug}`}><div className="catalog-card__media">{map.cover_thumbnail_url || map.cover_url ? <img src={map.cover_thumbnail_url || map.cover_url} alt={`${map.name_zh}封面`} loading="lazy" /> : <CatalogPlaceholder label={map.name_zh} />}</div><div><p className="eyebrow">{map.map_type || '未分类'} · {status}</p><h3>{map.name_zh}</h3>{map.name_en && <p className="game-card__english">{map.name_en}</p>}<p>{map.description || '暂无地图说明。'}</p><div className="catalog-card__stats"><span>{map.guide_count || 0} 个点位</span><span>{map.hero_with_guides_count || 0} 位英雄已有点位</span></div></div></Link></article>
}

export function MapHeroCard({ hero, gameSlug, mapSlug }) {
  return <article className={`catalog-card map-hero-card ${hero.has_guides ? 'has-guides' : ''}`}>
    <Link to={`/game/${gameSlug}/map/${mapSlug}/hero/${hero.slug}`}>
      <div className="catalog-card__media">{hero.avatar_thumbnail_url || hero.avatar_url ? <img src={hero.avatar_thumbnail_url || hero.avatar_url} alt={`${hero.name_zh}头像`} loading="lazy" /> : <CatalogPlaceholder label={hero.name_zh} />}</div>
      <div>
        <p className="eyebrow">{hero.role || '未标注定位'}</p>
        <h3>{hero.name_zh}</h3>
        {hero.name_en && <p className="game-card__english">{hero.name_en}</p>}
        <p className="map-hero-card__count">{hero.guide_count || 0} 个当前地图点位</p>
        <small>{hero.has_guides ? '打开点位列表' : '暂无点位，可以发布第一条'}</small>
      </div>
    </Link>
  </article>
}
