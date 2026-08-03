import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getLifePosts } from '../api/life.js'
import { useAuth } from '../auth/useAuth.js'
import LifePostCard from '../components/life/LifePostCard.jsx'
import MasonryFeed from '../components/layout/MasonryFeed.jsx'
import Pagination from '../components/life/Pagination.jsx'

function pageFrom(search) {
  const value = Number(search.get('page') || 1)
  return Number.isInteger(value) && value > 0 ? value : 1
}

export default function LifeHomePage() {
  const { isAuthenticated } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const scope = isAuthenticated && searchParams.get('scope') === 'mine' ? 'mine' : 'latest'
  const page = pageFrom(searchParams)
  const [state, setState] = useState({ key: null, posts: [], pagination: null, error: null })
  const [retry, setRetry] = useState(0)
  const requestKey = `${scope}:${page}:${retry}`

  useEffect(() => {
    let cancelled = false
    getLifePosts({ scope, page, page_size: 18 })
      .then((result) => {
        if (!cancelled) setState({ key: requestKey, posts: result.data, pagination: result.meta.pagination, error: null })
      })
      .catch((error) => {
        if (!cancelled) setState({ key: requestKey, posts: [], pagination: null, error })
      })
    return () => { cancelled = true }
  }, [scope, page, retry, requestKey])

  const loading = state.key !== requestKey
  const posts = loading ? [] : state.posts
  const error = loading ? null : state.error
  const pagination = loading ? null : state.pagination

  function changeScope(nextScope) {
    setSearchParams(nextScope === 'mine' ? { scope: 'mine' } : {})
  }

  function changePage(nextPage) {
    const next = new URLSearchParams(searchParams)
    if (scope === 'mine') next.set('scope', 'mine')
    next.set('page', String(nextPage))
    setSearchParams(next)
  }

  return (
    <section className="life-page page-container">
      <p className="eyebrow">日常 · 此刻与往日</p>
      <h1>让日子有处可回</h1>
      <p>照片留住光线，文字留住当时。短短一句，或一段很长的路，都值得被好好安放。</p>
      <div className="life-toolbar">
        <Link className="button button--primary" to="/life/create">写下此刻</Link>
        <Link className="button" to="/life/chapters">沿着合集翻看</Link>
        {isAuthenticated && (
          <div className="life-segmented" aria-label="日常范围">
            <button type="button" className={scope === 'latest' ? 'is-current' : ''} onClick={() => changeScope('latest')}>最新日常</button>
            <button type="button" className={scope === 'mine' ? 'is-current' : ''} onClick={() => changeScope('mine')}>我的日常</button>
          </div>
        )}
      </div>
      {loading && <p className="state-message">正在翻开这些日常…</p>}
      {error && (
        <div className="state-message state-message--error" role="alert">
          <p>{error.message}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>重新加载</button>
        </div>
      )}
      {!loading && !error && posts.length === 0 && <p className="life-empty">这一页还空着。写下一句话，或留下一张照片吧。</p>}
      {!loading && !error && posts.length > 0 && (
        <MasonryFeed ariaLabel={scope === 'mine' ? '我的日常列表' : '最新日常列表'}>
          {posts.map((post) => <LifePostCard key={post.id} post={post} />)}
        </MasonryFeed>
      )}
      <Pagination pagination={pagination} onPageChange={changePage} />
    </section>
  )
}
