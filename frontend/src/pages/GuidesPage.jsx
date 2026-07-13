/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getGuides } from '../api/guides.js'
import GuideCard from '../components/guides/GuideCard.jsx'
import Pagination from '../components/life/Pagination.jsx'

const FILTER_NAMES = ['game_slug', 'hero_slug', 'map_slug', 'category', 'side', 'difficulty', 'validity_status', 'game_version', 'sort']

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

  return <section className="guides-page page-container"><p className="eyebrow">游戏教材</p><h1>把实战经验讲清楚</h1><div className="guide-filters"><input value={input} placeholder="搜索教材" onChange={(event) => setInput(event.target.value)} /><select value={filters.category} onChange={(event) => update({ category: event.target.value })}><option value="">全部分类</option><option value="skill_position">技能点位</option><option value="grenade_throw">手雷投掷</option><option value="other">其他技巧</option></select><select value={filters.difficulty} onChange={(event) => update({ difficulty: event.target.value })}><option value="">全部难度</option><option value="beginner">入门</option><option value="intermediate">中等</option><option value="advanced">进阶</option></select><select value={filters.sort || 'latest'} onChange={(event) => update({ sort: event.target.value === 'updated' ? 'updated' : '' })}><option value="latest">最新发布</option><option value="updated">最近更新</option></select></div>{state.loading && <p className="state-message">正在加载教材…</p>}{state.error && <div className="state-message state-message--error"><p>{state.error.message}</p><button onClick={() => setRetry((item) => item + 1)}>重新加载</button></div>}{!state.loading && !state.error && !state.data.length && <p className="life-empty">还没有符合条件的教材。</p>}{!state.loading && !state.error && <div className="guide-grid">{state.data.map((guide) => <GuideCard key={guide.id} guide={guide} />)}</div>}<Pagination pagination={state.loading ? null : state.pagination} onPageChange={(next) => update({ page: String(next) })} /></section>
}
