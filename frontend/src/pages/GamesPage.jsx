import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { getGames } from '../api/games.js'
import { GameCard } from '../components/games/CatalogCards.jsx'
import Pagination from '../components/life/Pagination.jsx'

export default function GamesPage() {
  const [search, setSearch] = useSearchParams(); const query = search.get('query') || ''; const sort = search.get('sort') === 'latest' ? 'latest' : 'name'; const page = Math.max(1, Number(search.get('page')) || 1)
  return <GamesList key={query} query={query} sort={sort} page={page} search={search} setSearch={setSearch} />
}
function GamesList({ query, sort, page, search, setSearch }) {
  const [input, setInput] = useState(query); const [state, setState] = useState({ key: null, data: [], pagination: null, error: null }); const [retry, setRetry] = useState(0); const key = `${query}:${sort}:${page}:${retry}`
  useEffect(() => { const timer = setTimeout(() => { if (input !== query) { const next = new URLSearchParams(search); input.trim() ? next.set('query', input.trim()) : next.delete('query'); next.delete('page'); setSearch(next) } }, 350); return () => clearTimeout(timer) }, [input, query, search, setSearch])
  useEffect(() => { let stop = false; getGames({ query, sort, page, page_size: 12 }).then((result) => !stop && setState({ key, data: result.data, pagination: result.meta.pagination, error: null })).catch((error) => !stop && setState({ key, data: [], pagination: null, error })); return () => { stop = true } }, [query, sort, page, retry, key])
  const loading = state.key !== key; const error = loading ? null : state.error; const data = loading ? [] : state.data
  function update(values) { const next = new URLSearchParams(search); Object.entries(values).forEach(([name, value]) => value ? next.set(name, value) : next.delete(name)); if (!Object.hasOwn(values, 'page')) next.delete('page'); setSearch(next) }
  if (!loading && !error && data.length === 1 && !query && page === 1) return <Navigate to={`/game/${data[0].slug}/maps`} replace />
  return <section className="games-page page-container"><p className="eyebrow">游戏区</p><h1>从地图开始查点位</h1><p>英雄和地图由平台统一维护；进入游戏后先选择当前地图。</p><div className="catalog-toolbar"><input value={input} placeholder="搜索游戏" onChange={(event) => setInput(event.target.value)} /><select value={sort} onChange={(event) => update({ sort: event.target.value === 'latest' ? 'latest' : '' })}><option value="name">按名称</option><option value="latest">最新创建</option></select></div>{loading && <p className="state-message">正在打开游戏目录…</p>}{error && <div className="state-message state-message--error"><p>{error.message}</p><button onClick={() => setRetry((item) => item + 1)}>重新加载</button></div>}{!loading && !error && !data.length && <p className="life-empty">游戏目录还没有内容。</p>}{!loading && !error && <div className="catalog-grid">{data.map((game) => <GameCard key={game.id} game={game} />)}</div>}<Pagination pagination={loading ? null : state.pagination} onPageChange={(next) => update({ page: String(next) })} /></section>
}
