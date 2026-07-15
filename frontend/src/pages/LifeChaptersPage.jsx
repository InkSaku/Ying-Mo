import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getLifeChapters } from '../api/life.js'
import AdaptiveMedia from '../components/common/AdaptiveMedia.jsx'
import Pagination from '../components/life/Pagination.jsx'

const types = {
  city: '城市', scenic: '景点', travel: '旅行', campus: '校园', event: '活动', custom: '自定义',
}

function positivePage(value) {
  const page = Number(value || 1)
  return Number.isInteger(page) && page > 0 ? page : 1
}

export default function LifeChaptersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('query') || ''
  const type = searchParams.get('chapter_type') || ''
  const sort = searchParams.get('sort') === 'popular' ? 'popular' : 'latest'
  const page = positivePage(searchParams.get('page'))

  return <LifeChaptersContent key={query} searchParams={searchParams} setSearchParams={setSearchParams} query={query} type={type} sort={sort} page={page} />
}

function LifeChaptersContent({ searchParams, setSearchParams, query, type, sort, page }) {
  const [input, setInput] = useState(query)
  const [state, setState] = useState({ key: null, items: [], pagination: null, error: null })
  const [retry, setRetry] = useState(0)
  const requestKey = `${query}:${type}:${sort}:${page}:${retry}`

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (input === query) return
      const next = new URLSearchParams(searchParams)
      if (input.trim()) next.set('query', input.trim())
      else next.delete('query')
      next.delete('page')
      setSearchParams(next)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [input, query, searchParams, setSearchParams])
  useEffect(() => {
    let cancelled = false
    getLifeChapters({ query, chapter_type: type, sort, page, page_size: 12 })
      .then((result) => !cancelled && setState({ key: requestKey, items: result.data, pagination: result.meta.pagination, error: null }))
      .catch((error) => !cancelled && setState({ key: requestKey, items: [], pagination: null, error }))
    return () => { cancelled = true }
  }, [query, type, sort, page, retry, requestKey])

  const loading = state.key !== requestKey
  const items = loading ? [] : state.items
  const error = loading ? null : state.error
  const pagination = loading ? null : state.pagination

  function update(filters) {
    const next = new URLSearchParams(searchParams)
    Object.entries(filters).forEach(([key, value]) => {
      if (value) next.set(key, value)
      else next.delete(key)
    })
    if (!Object.hasOwn(filters, 'page')) next.delete('page')
    setSearchParams(next)
  }

  return (
    <section className="life-page page-container">
      <p className="eyebrow">生活章节</p>
      <h1>从一个地方开始</h1>
      <p>城市、旅途和共同经历，都可以成为一段持续生长的生活记录。</p>
      <div className="life-toolbar life-toolbar--filters">
        <input value={input} placeholder="搜索章节" aria-label="搜索章节" onChange={(event) => setInput(event.target.value)} />
        <select value={type} aria-label="章节类型" onChange={(event) => update({ chapter_type: event.target.value })}>
          <option value="">全部类型</option>
          {Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={sort} aria-label="排序方式" onChange={(event) => update({ sort: event.target.value === 'popular' ? 'popular' : '' })}>
          <option value="latest">最新创建</option>
          <option value="popular">热门章节</option>
        </select>
        <Link className="button button--primary" to="/life/chapters/create">创建章节</Link>
      </div>
      {loading && <p className="state-message">正在寻找相关章节…</p>}
      {error && <div className="state-message state-message--error" role="alert"><p>{error.message}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>重新加载</button></div>}
      {!loading && !error && items.length === 0 && <p className="life-empty">还没有找到相符的章节，换个词试试，或创建一段新的生活章节。</p>}
      {!loading && !error && items.length > 0 && (
        <div className="chapter-list">
          {items.map((chapter) => (
            <Link className="chapter-list__item" key={chapter.id} to={`/life/chapter/${chapter.slug}`}>
              <span className="chapter-list__cover">{chapter.cover_thumbnail_url ? <AdaptiveMedia src={chapter.cover_thumbnail_url} alt={`${chapter.name} 的封面`} /> : <span aria-hidden="true">映</span>}</span>
              <div>
                <p className="chapter-list__meta">{chapter.parent ? `${chapter.parent.name} · ` : ''}{types[chapter.chapter_type]}</p>
                <strong>{chapter.name}</strong>
                <p>{chapter.description || '等待一段新的日常。'}</p>
                <small>{[chapter.country, chapter.province, chapter.city].filter(Boolean).join(' · ') || '未标注地区'} · {chapter.content_count} 条日常 · {chapter.contributor_count} 位参与者</small>
              </div>
            </Link>
          ))}
        </div>
      )}
      <Pagination pagination={pagination} onPageChange={(nextPage) => update({ page: String(nextPage) })} />
    </section>
  )
}
