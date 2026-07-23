/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getGame, getGameHero, getGameHeroes, getGameMap, getGameMapHeroes, getGameMaps } from '../api/games.js'
import { getGuides } from '../api/guides.js'
import { CatalogPlaceholder, HeroCard, MapCard, MapHeroCard } from '../components/games/CatalogCards.jsx'
import GuideCard from '../components/guides/GuideCard.jsx'
import Pagination from '../components/life/Pagination.jsx'


const MAP_STATUS = {
  active: '当前可用',
  rotated_out: '暂时轮换外',
  retired: '已退役',
}


function errorTitle(error, resource) {
  if (error?.code === 'GAME_INACTIVE') return '这款游戏目录尚未启用'
  if (error?.code === 'RESOURCE_NOT_FOUND') return `没有找到${resource}`
  return `${resource}加载失败`
}


function State({ state, empty, resource = '内容', children }) {
  if (state.loading) return <p className="state-message">正在加载{resource}…</p>
  if (state.error) return <div className="state-message state-message--error" role="alert"><h2>{errorTitle(state.error, resource)}</h2><p>{state.error.message}</p><button type="button" onClick={state.retry}>重新加载</button></div>
  const collection = Array.isArray(state.data) ? state.data : state.data?.data
  if (Array.isArray(collection) && !collection.length && empty) return <p className="life-empty">{empty}</p>
  return children
}


function useData(loader, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: null, retry: () => {} })
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let dead = false
    setState((current) => ({ ...current, loading: true, error: null }))
    loader()
      .then((data) => !dead && setState({ loading: false, data, error: null, retry: () => setRetry((value) => value + 1) }))
      .catch((error) => !dead && setState({ loading: false, data: null, error, retry: () => setRetry((value) => value + 1) }))
    return () => { dead = true }
  }, [...deps, retry])
  return state
}


export function GameHeroesPage() {
  const { gameSlug } = useParams()
  const state = useData(() => getGameHeroes(gameSlug, { page_size: 100 }), [gameSlug])
  return <section className="games-page page-container">
    <Link className="text-link" to={`/game/${gameSlug}/maps`}>返回地图目录</Link>
    <p className="eyebrow">辅助入口</p>
    <h1>英雄目录</h1>
    <p>英雄通用页只用于辅助浏览；查找点位时请先选择地图。</p>
    <State state={state} empty="暂无可用英雄。" resource="英雄目录">{state.data && <div className="catalog-grid">{state.data.data.map((hero) => <HeroCard key={hero.id} hero={hero} />)}</div>}</State>
  </section>
}


export function GameMapsPage() {
  const { gameSlug } = useParams()
  const gameState = useData(() => getGame(gameSlug), [gameSlug])
  const mapsState = useData(() => getGameMaps(gameSlug, { page_size: 100 }), [gameSlug])
  return <section className="games-page game-maps-page page-container">
    <Link className="text-link" to="/games">返回游戏目录</Link>
    <State state={gameState} resource="游戏">
      {gameState.data && <>
        <header className="catalog-page-header">
          <p className="eyebrow">{gameState.data.name_zh} · 地图优先</p>
          <h1>选择当前地图</h1>
          <p>{gameState.data.description || '打开当前地图，再从这张地图中选择英雄。'}</p>
          <div className="catalog-page-header__stats"><span>{gameState.data.usable_map_count ?? gameState.data.map_count ?? 0} 张可用地图</span><span>{gameState.data.guide_count || 0} 个公开点位</span></div>
        </header>
        <State state={mapsState} empty="这款游戏还没有公开地图。" resource="地图目录">
          {mapsState.data && <div className="catalog-grid catalog-grid--maps">{mapsState.data.data.map((map) => <MapCard key={map.id} map={map} />)}</div>}
        </State>
      </>}
    </State>
  </section>
}


export function GameMapDetailPage() {
  const { gameSlug, mapSlug } = useParams()
  const [search, setSearch] = useSearchParams()
  const [query, setQuery] = useState(search.get('query') || '')
  useEffect(() => setQuery(search.get('query') || ''), [search])
  const role = search.get('role') || ''
  const only = search.get('with_guides') === 'true'
  const mapState = useData(() => getGameMap(gameSlug, mapSlug), [gameSlug, mapSlug])
  const heroesState = useData(
    () => getGameMapHeroes(gameSlug, mapSlug, {
      page_size: 100,
      query: search.get('query') || '',
      role,
      with_guides: only ? 'true' : '',
    }),
    [gameSlug, mapSlug, search.toString()],
  )

  function update(values) {
    const next = new URLSearchParams(search)
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    setSearch(next)
  }

  const map = mapState.data
  const heroEmpty = search.get('query') || role || only
    ? '没有符合当前筛选条件的英雄。'
    : '这款游戏还没有可用英雄。'

  return <section className="games-page game-map-detail page-container">
    <Link className="text-link" to={`/game/${gameSlug}/maps`}>返回地图目录</Link>
    <State state={mapState} resource="地图">
      {map && <>
        <header className="map-detail-hero">
          <div className="map-detail-hero__media">{map.cover_url || map.cover_thumbnail_url ? <img src={map.cover_url || map.cover_thumbnail_url} alt={`${map.name_zh}封面`} /> : <CatalogPlaceholder label={map.name_zh} />}</div>
          <div className="map-detail-hero__body">
            <p className="eyebrow">{map.game.name_zh} · {map.map_type || '未标注地图类型'}</p>
            <h1>{map.name_zh}</h1>
            {map.name_en && <p className="game-card__english">{map.name_en}</p>}
            <span className={`map-status map-status--${map.current_status}`}>{MAP_STATUS[map.current_status] || map.current_status}</span>
            <p>{map.description || '选择英雄，查看这张地图中可直接使用的点位。'}</p>
            <div className="game-point-summary"><span>{map.guide_count || 0} 个点位</span><span>{map.hero_with_guides_count || 0} 位英雄已有点位</span></div>
            {map.current_status !== 'retired'
              ? <Link className="button button--primary" to={`/guide/create?game=${gameSlug}&map=${mapSlug}`}>发布该地图点位</Link>
              : <p className="catalog-warning">这张地图已退役。历史点位仍可查看，但不能用于新建点位。</p>}
          </div>
        </header>
        {map.current_status === 'rotated_out' && <p className="catalog-warning">这张地图暂时不在当前轮换中，已有点位仍可正常查看。</p>}
        {!map.guide_count && <p className="catalog-notice">这张地图暂无点位。选择英雄后，可以发布第一个实用点位。</p>}
        <section className="catalog-section hero-picker">
          <div className="catalog-section__heading"><div><h2>选择英雄</h2><p>已有点位的英雄优先；没有点位的英雄仍可选择。</p></div></div>
          <form className="catalog-toolbar" onSubmit={(event) => { event.preventDefault(); update({ query }) }}>
            <label className="catalog-toolbar__search">搜索英雄<input aria-label="搜索英雄" value={query} placeholder="中文名、英文名或别名" onChange={(event) => setQuery(event.target.value)} /></label>
            <label>英雄定位<select aria-label="英雄定位" value={role} onChange={(event) => update({ role: event.target.value })}><option value="">全部定位</option><option value="tank">重装</option><option value="damage">输出</option><option value="support">支援</option></select></label>
            <label className="catalog-toolbar__check"><input type="checkbox" checked={only} onChange={(event) => update({ with_guides: event.target.checked ? 'true' : '' })} />只看已有点位英雄</label>
            <button type="submit">搜索</button>
          </form>
          <State state={heroesState} empty={heroEmpty} resource="英雄">
            {heroesState.data && <div className="catalog-grid hero-picker__grid">{heroesState.data.data.map((hero) => <MapHeroCard key={hero.id} hero={hero} gameSlug={gameSlug} mapSlug={mapSlug} />)}</div>}
          </State>
        </section>
      </>}
    </State>
  </section>
}


export function GameHeroDetailPage() {
  const { gameSlug, heroSlug } = useParams()
  const state = useData(() => getGameHero(gameSlug, heroSlug), [gameSlug, heroSlug])
  return <section className="games-page page-container">
    <Link className="text-link" to={`/game/${gameSlug}/heroes`}>返回英雄</Link>
    <State state={state} resource="英雄">{state.data && <article className="catalog-detail"><p className="eyebrow">辅助英雄入口</p><h1>{state.data.name_zh}</h1><p>{state.data.description || '请从地图进入，查看该英雄在对应地图的点位。'}</p><Link className="button" to={`/game/${gameSlug}/maps`}>先选地图</Link></article>}</State>
  </section>
}


export function GamePointListPage() {
  const { gameSlug, mapSlug, heroSlug } = useParams()
  const [search, setSearch] = useSearchParams()
  const [query, setQuery] = useState(search.get('query') || '')
  useEffect(() => setQuery(search.get('query') || ''), [search])
  const mapState = useData(() => getGameMap(gameSlug, mapSlug), [gameSlug, mapSlug])
  const heroState = useData(() => getGameHero(gameSlug, heroSlug), [gameSlug, heroSlug])
  const page = Math.max(1, Number(search.get('page')) || 1)
  const state = useData(() => getGuides({
    game_slug: gameSlug,
    map_slug: mapSlug,
    hero_slug: heroSlug,
    query: search.get('query') || '',
    category: search.get('category') || '',
    side: search.get('side') || '',
    map_area: search.get('map_area') || '',
    validity_status: search.get('validity_status') || '',
    sort: search.get('sort') || 'updated',
    page,
    page_size: 12,
  }), [gameSlug, mapSlug, heroSlug, search.toString()])
  const contextReady = mapState.data && heroState.data
  const canPublish = contextReady && mapState.data.is_available !== false && heroState.data.is_available !== false

  function update(values) {
    const next = new URLSearchParams(search)
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    if (!Object.hasOwn(values, 'page')) next.delete('page')
    setSearch(next)
  }

  return <section className="guides-page page-container">
    <Link className="text-link" to={`/game/${gameSlug}/map/${mapSlug}`}>返回地图英雄选择</Link>
    <State state={mapState} resource="地图">
      <State state={heroState} resource="英雄">
        {contextReady && <>
          <header className="guide-combination-header">
            <p className="eyebrow">{mapState.data.game.name_zh} · 地图 + 英雄</p>
            <h1>{mapState.data.name_zh} · {heroState.data.name_zh}</h1>
            <p>只展示当前地图与当前英雄的点位，不需要再次选择目录。</p>
            {canPublish
              ? <Link className="button button--primary" to={`/guide/create?game=${gameSlug}&map=${mapSlug}&hero=${heroSlug}`}>发布当前组合点位</Link>
              : <p className="catalog-warning">当前游戏、地图或英雄已停用；历史点位仍可查看，但不能为这个组合发布新点位。</p>}
          </header>
          <form className="guide-filters guide-combination-filters" onSubmit={(event) => { event.preventDefault(); update({ query, map_area: search.get('map_area') || '' }) }}>
            <label>关键词<input aria-label="搜索当前组合点位" value={query} placeholder="标题、说明、技能或标签" onChange={(event) => setQuery(event.target.value)} /></label>
            <label>分类<select aria-label="点位分类筛选" value={search.get('category') || ''} onChange={(event) => update({ category: event.target.value })}><option value="">全部分类</option><option value="deployment_position">炮台与部署点位</option><option value="skill_throw">技能投掷</option><option value="timed_throw">开局定时投掷</option><option value="hold_position">架枪与站位</option><option value="movement_route">位移与路线</option><option value="map_interaction">地图机制与交互</option><option value="other">其他点位</option></select></label>
            <label>攻防方<select aria-label="攻防方筛选" value={search.get('side') || ''} onChange={(event) => update({ side: event.target.value })}><option value="">全部</option><option value="attack">进攻方</option><option value="defense">防守方</option><option value="both">攻防皆可</option></select></label>
            <label>地图区域<input aria-label="地图区域筛选" value={search.get('map_area') || ''} onChange={(event) => update({ map_area: event.target.value })} placeholder="例如：A 区" /></label>
            <label>有效状态<select aria-label="有效状态筛选" value={search.get('validity_status') || ''} onChange={(event) => update({ validity_status: event.target.value })}><option value="">全部状态</option><option value="unverified">未验证</option><option value="valid">当前有效</option><option value="possibly_invalid">可能失效</option><option value="invalid">已失效</option></select></label>
            <label>排序<select aria-label="点位排序" value={search.get('sort') || 'updated'} onChange={(event) => update({ sort: event.target.value === 'updated' ? '' : event.target.value })}><option value="updated">最近更新</option><option value="latest">最新发布</option><option value="popular">热门</option></select></label>
            <button type="submit">搜索</button>
          </form>
          <State state={state} empty="这个英雄在这张地图还没有点位，记录第一个实用位置吧。" resource="点位">
            {state.data && <div className="guide-grid">{state.data.data.map((guide) => <GuideCard key={guide.id} guide={guide} />)}</div>}
          </State>
          <Pagination pagination={state.loading ? null : state.data?.meta?.pagination} onPageChange={(next) => update({ page: String(next) })} />
        </>}
      </State>
    </State>
  </section>
}
