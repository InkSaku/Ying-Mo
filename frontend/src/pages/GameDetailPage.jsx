import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getGame } from '../api/games.js'
import { MapCard } from '../components/games/CatalogCards.jsx'

export default function GameDetailPage() {
  const { gameSlug } = useParams(); const [state, setState] = useState({ loading: true, data: null, error: null }); const [retry, setRetry] = useState(0)
  useEffect(() => { let dead = false; getGame(gameSlug).then((data) => !dead && setState({ loading: false, data, error: null })).catch((error) => !dead && setState({ loading: false, data: null, error })); return () => { dead = true } }, [gameSlug, retry])
  if (state.loading) return <section className="games-page page-container"><p className="state-message">正在打开游戏…</p></section>
  if (state.error) return <section className="games-page page-container"><div className="state-message state-message--error"><p>{state.error.message}</p><button onClick={() => setRetry((n) => n + 1)}>重新加载</button></div></section>
  const game = state.data
  return <section className="games-page page-container"><Link className="text-link" to="/games">返回游戏区</Link><header className="game-hero">{game.cover_url ? <img src={game.cover_url} alt={`${game.name_zh} 封面`} /> : <div className="game-hero__placeholder">映</div>}<div><p className="eyebrow">{game.current_version || '当前版本未标注'}</p><h1>{game.name_zh}</h1><p>{game.description || '先选择地图，再选择英雄，快速查找可直接使用的点位。'}</p><div className="life-toolbar"><Link className="button button--primary" to={`/game/${game.slug}/maps`}>选择地图</Link><Link className="button" to={`/game/${game.slug}/heroes`}>辅助英雄入口</Link></div></div></header><section className="catalog-section"><div className="catalog-section__heading"><h2>地图优先</h2><Link className="text-link" to={`/game/${game.slug}/maps`}>查看全部地图</Link></div>{game.featured_maps?.length ? <div className="catalog-grid">{game.featured_maps.map((map) => <MapCard key={map.id} map={map} />)}</div> : <p className="life-empty">暂时还没有公开地图。</p>}</section></section>
}
