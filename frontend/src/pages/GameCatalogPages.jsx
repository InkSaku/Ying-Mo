/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getGameHero, getGameHeroes, getGameMap, getGameMapHeroes, getGameMaps } from '../api/games.js'
import { getGuides } from '../api/guides.js'
import { HeroCard, MapCard } from '../components/games/CatalogCards.jsx'
import GuideCard from '../components/guides/GuideCard.jsx'

function State({ state, empty, children }) {
  if (state.loading) return <p className="state-message">正在加载…</p>
  if (state.error) return <div className="state-message state-message--error"><p>{state.error.message}</p><button onClick={state.retry}>重新加载</button></div>
  if (!state.data?.length && empty) return <p className="life-empty">{empty}</p>
  return children
}
function useData(loader, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: null, retry: () => {} })
  const [retry, setRetry] = useState(0)
  useEffect(() => { let dead = false; setState((s) => ({ ...s, loading: true, error: null })); loader().then((data) => !dead && setState({ loading: false, data, error: null, retry: () => setRetry((n) => n + 1) })).catch((error) => !dead && setState({ loading: false, data: null, error, retry: () => setRetry((n) => n + 1) })); return () => { dead = true } }, [...deps, retry])
  return state
}

export function GameHeroesPage() {
  const { gameSlug } = useParams(); const state = useData(() => getGameHeroes(gameSlug, { page_size: 100 }), [gameSlug])
  return <section className="games-page page-container"><Link className="text-link" to={`/game/${gameSlug}`}>返回游戏</Link><p className="eyebrow">辅助入口</p><h1>英雄目录</h1><State state={state} empty="暂无可用英雄。">{state.data && <div className="catalog-grid">{state.data.data.map((hero) => <HeroCard key={hero.id} hero={hero} />)}</div>}</State></section>
}
export function GameMapsPage() {
  const { gameSlug } = useParams(); const state = useData(() => getGameMaps(gameSlug, { page_size: 100 }), [gameSlug])
  return <section className="games-page page-container"><Link className="text-link" to={`/game/${gameSlug}`}>返回游戏</Link><p className="eyebrow">地图优先</p><h1>选择当前地图</h1><State state={state} empty="暂无可用地图。">{state.data && <div className="catalog-grid">{state.data.data.map((map) => <MapCard key={map.id} map={map} />)}</div>}</State></section>
}
export function GameMapDetailPage() {
  const { gameSlug, mapSlug } = useParams(); const [search, setSearch] = useSearchParams(); const [query, setQuery] = useState(search.get('query') || ''); const role = search.get('role') || ''; const only = search.get('with_guides') === 'true'
  const mapState = useData(() => getGameMap(gameSlug, mapSlug), [gameSlug, mapSlug])
  const heroesState = useData(() => getGameMapHeroes(gameSlug, mapSlug, { page_size: 100, query: search.get('query') || '', role, with_guides: only ? 'true' : '' }), [gameSlug, mapSlug, search.toString()])
  function update(values) { const next = new URLSearchParams(search); Object.entries(values).forEach(([k, v]) => v ? next.set(k, v) : next.delete(k)); setSearch(next) }
  return <section className="games-page page-container"><Link className="text-link" to={`/game/${gameSlug}/maps`}>返回地图</Link><State state={mapState}>{mapState.data && <><header className="catalog-detail"><p className="eyebrow">{mapState.data.game.name_zh} · {mapState.data.map_type || '地图'}</p><h1>{mapState.data.name_zh}</h1><p>{mapState.data.description || '选择英雄，查看这张地图中可直接使用的点位。'}</p><p className="game-point-summary">{mapState.data.guide_count || 0} 个点位 · {mapState.data.hero_with_guides_count || 0} 位英雄已有点位</p><Link className="button button--primary" to={`/guide/create?game=${gameSlug}&map=${mapSlug}`}>为这张地图发布点位</Link></header><section className="catalog-section"><div className="catalog-section__heading"><h2>选择英雄</h2><span>有点位的英雄排在前面</span></div><div className="catalog-toolbar"><input value={query} placeholder="搜索英雄" onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && update({ query })} /><input value={role} placeholder="定位筛选" onChange={(e) => update({ role: e.target.value })} /><label><input type="checkbox" checked={only} onChange={(e) => update({ with_guides: e.target.checked ? 'true' : '' })} /> 只看已有点位</label><button onClick={() => update({ query })}>搜索</button></div><State state={heroesState} empty="这个筛选下还没有英雄。">{heroesState.data && <div className="catalog-grid">{heroesState.data.data.map((hero) => <article className="catalog-card" key={hero.id}><Link to={`/game/${gameSlug}/map/${mapSlug}/hero/${hero.slug}`}><div className="catalog-card__media">{hero.avatar_thumbnail_url ? <img src={hero.avatar_thumbnail_url} alt="" /> : <span>映</span>}</div><div><p className="eyebrow">{hero.role || '英雄'} · {hero.guide_count} 个点位</p><h3>{hero.name_zh}</h3><p>{hero.has_guides ? '查看当前地图点位' : '暂无点位，欢迎补充'}</p></div></Link></article>)}</div>}</State></section></>}</State></section>
}
export function GameHeroDetailPage() {
  const { gameSlug, heroSlug } = useParams(); const state = useData(() => getGameHero(gameSlug, heroSlug), [gameSlug, heroSlug])
  return <section className="games-page page-container"><Link className="text-link" to={`/game/${gameSlug}/heroes`}>返回英雄</Link><State state={state}>{state.data && <article className="catalog-detail"><p className="eyebrow">辅助英雄入口</p><h1>{state.data.name_zh}</h1><p>{state.data.description || '请从地图进入，查看该英雄在对应地图的点位。'}</p><Link className="button" to={`/game/${gameSlug}/maps`}>先选地图</Link></article>}</State></section>
}
export function GamePointListPage() {
  const { gameSlug, mapSlug, heroSlug } = useParams(); const state = useData(() => getGuides({ game_slug: gameSlug, map_slug: mapSlug, hero_slug: heroSlug, page_size: 100, sort: 'updated' }), [gameSlug, mapSlug, heroSlug])
  return <section className="guides-page page-container"><Link className="text-link" to={`/game/${gameSlug}/map/${mapSlug}`}>返回英雄选择</Link><p className="eyebrow">地图 + 英雄</p><h1>{state.data?.data?.[0] ? `${state.data.data[0].map.name_zh} · ${state.data.data[0].hero.name_zh}` : '当前地图点位'}</h1><div className="life-toolbar"><Link className="button button--primary" to={`/guide/create?game=${gameSlug}&map=${mapSlug}&hero=${heroSlug}`}>发布当前组合点位</Link></div><State state={state} empty="这个英雄在这张地图还没有点位，记录第一个实用位置吧。">{state.data && <div className="guide-grid">{state.data.data.map((guide) => <GuideCard key={guide.id} guide={guide} />)}</div>}</State></section>
}
