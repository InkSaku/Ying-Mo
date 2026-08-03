/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getGuides } from '../api/guides.js'
import GuideCard from '../components/guides/GuideCard.jsx'
import Pagination from '../components/life/Pagination.jsx'

const FILTER_NAMES = ['game_slug', 'hero_slug', 'map_slug', 'category', 'side', 'map_area', 'validity_status', 'game_version', 'tag', 'sort']

export default function GuidesPage() {
  const [search, setSearch] = useSearchParams()
  const query = search.get('query') || ''
  const page = Math.max(1, Number(search.get('page')) || 1)
  const searchKey = search.toString()
  const filters = useMemo(
    () => Object.fromEntries(FILTER_NAMES.map((name) => [name, search.get(name) || ''])),
    // searchKey represents the scalar URL state and avoids a fresh object dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchKey],
  )
  const [input, setInput] = useState(query)
  const [state, setState] = useState({ loading: true, data: [], pagination: null, error: null })
  const [retry, setRetry] = useState(0)

  useEffect(() => { setInput(query) }, [query])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = input.trim()
      if (value === query) return
      const next = new URLSearchParams(searchKey)
      value ? next.set('query', value) : next.delete('query')
      next.delete('page')
      setSearch(next)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [input, query, searchKey, setSearch])

  useEffect(() => {
    const controller = new AbortController()
    setState((current) => ({ ...current, loading: true, error: null }))
    getGuides({ query, page, page_size: 12, ...filters, sort: filters.sort || 'latest' }, controller.signal)
      .then((result) => setState({ loading: false, data: result.data, pagination: result.meta.pagination, error: null }))
      .catch((error) => { if (error.name !== 'CanceledError' && error.name !== 'AbortError') setState({ loading: false, data: [], pagination: null, error }) })
    return () => controller.abort()
  }, [query, page, filters, retry])

  function update(values) {
    const next = new URLSearchParams(searchKey)
    Object.entries(values).forEach(([name, value]) => value ? next.set(name, value) : next.delete(name))
    if (!Object.hasOwn(values, 'page')) next.delete('page')
    setSearch(next)
  }

  return <section className="guides-page page-container"><p className="eyebrow">实战路标</p><h1>找一处能落脚的点位</h1><p>站位、朝向、路线与时机，都有人替你认真标在地图上。</p><div className="guide-filters"><input value={input} placeholder="按标题或说明搜索" aria-label="搜索点位" onChange={(event) => setInput(event.target.value)} /><select aria-label="点位分类" value={filters.category} onChange={(event) => update({ category: event.target.value })}><option value="">全部分类</option><option value="deployment_position">炮台与部署点位</option><option value="skill_throw">技能投掷</option><option value="timed_throw">开局定时投掷</option><option value="hold_position">架枪与站位</option><option value="movement_route">位移与路线</option><option value="map_interaction">地图机制与交互</option><option value="other">其他点位</option></select><select aria-label="点位排序" value={filters.sort || 'latest'} onChange={(event) => update({ sort: event.target.value === 'latest' ? '' : event.target.value })}><option value="latest">新近留下</option><option value="updated">最近修订</option><option value="popular">大家常看</option></select></div>{state.loading && <p className="state-message">正在寻找点位…</p>}{state.error && <div className="state-message state-message--error"><p>{state.error.message}</p><button onClick={() => setRetry((item) => item + 1)}>重新加载</button></div>}{!state.loading && !state.error && !state.data.length && <p className="life-empty">这条路上还没有合适的标记，换个条件再找找吧。</p>}{!state.loading && !state.error && state.data.length > 0 && <div className="masonry-feed">{state.data.map((guide) => <GuideCard key={guide.id} guide={guide} className="masonry-feed__item" />)}</div>}<Pagination pagination={state.loading ? null : state.pagination} onPageChange={(next) => update({ page: String(next) })} /></section>
}
