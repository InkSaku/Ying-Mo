import { Link } from 'react-router-dom'

export function GameCard({ game }) {
  return <article className="game-card"><Link to={`/game/${game.slug}`}><div className="game-card__media">{game.cover_thumbnail_url || game.icon_thumbnail_url ? <img src={game.cover_thumbnail_url || game.icon_thumbnail_url} alt={`${game.name_zh} 封面`} loading="lazy" /> : <span>映</span>}</div><div><p className="eyebrow">{game.current_version || '游戏目录'}</p><h3>{game.name_zh}</h3>{game.name_en && <p className="game-card__english">{game.name_en}</p>}<p>{game.description || '等待管理员补充这款游戏的简介。'}</p><small>{game.hero_count} 位英雄 · {game.map_count} 张地图</small></div></Link></article>
}
export function HeroCard({ hero }) {
  return <article className="catalog-card"><Link to={`/game/${hero.game.slug}/hero/${hero.slug}`}><div className="catalog-card__media">{hero.avatar_thumbnail_url ? <img src={hero.avatar_thumbnail_url} alt={`${hero.name_zh} 头像`} loading="lazy" /> : <span>映</span>}</div><div><p className="eyebrow">{hero.role || '未标注定位'}</p><h3>{hero.name_zh}</h3>{hero.name_en && <p className="game-card__english">{hero.name_en}</p>}<p>{hero.description || '暂无英雄说明。'}</p></div></Link></article>
}
export function MapCard({ map }) {
  return <article className="catalog-card catalog-card--map"><Link to={`/game/${map.game.slug}/map/${map.slug}`}><div className="catalog-card__media">{map.cover_thumbnail_url ? <img src={map.cover_thumbnail_url} alt={`${map.name_zh} 封面`} loading="lazy" /> : <span>映</span>}</div><div><p className="eyebrow">{map.map_type || '未分类'} · {({ active: '当前启用', rotated_out: '暂时移出轮换', retired: '已退役' })[map.current_status]}</p><h3>{map.name_zh}</h3>{map.name_en && <p className="game-card__english">{map.name_en}</p>}<p>{map.description || '暂无地图说明。'}</p></div></Link></article>
}
