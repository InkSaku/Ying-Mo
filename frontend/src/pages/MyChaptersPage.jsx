import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getMyChapters } from '../api/users.js'
import AdaptiveMedia from '../components/common/AdaptiveMedia.jsx'
import ChapterDeleteDialog from '../components/life/ChapterDeleteDialog.jsx'

const filters = [
  ['all', '全部'],
  ['pending', '待审核'],
  ['approved', '已通过'],
  ['rejected', '已驳回'],
  ['disabled', '已禁用'],
  ['merged', '已合并'],
]
const reviewLabels = { pending: '待审核', approved: '已通过', rejected: '已驳回' }
const statusLabels = { active: '已启用', disabled: '已禁用', merged: '已合并' }

export default function MyChaptersPage() {
  const [search, setSearch] = useSearchParams()
  const filter = filters.some(([key]) => key === search.get('filter')) ? search.get('filter') : 'all'
  const [state, setState] = useState({ loading: true, items: [], error: null })
  const [deleting, setDeleting] = useState(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    const params = filter === 'all' ? { page_size: 100 } : ['disabled', 'merged'].includes(filter) ? { status: filter, page_size: 100 } : { review_status: filter, page_size: 100 }
    getMyChapters(params).then((result) => {
      if (!cancelled) setState({ loading: false, items: result.data, error: null })
    }).catch((error) => {
      if (!cancelled) setState({ loading: false, items: [], error })
    })
    return () => { cancelled = true }
  }, [filter, retry])

  return (
    <section>
      <div className="life-section__heading"><div><p className="eyebrow">章节所有权</p><h2>我的章节</h2></div><Link className="button button--primary" to="/life/chapters/create">创建章节</Link></div>
      <div className="account-tabs">{filters.map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => setSearch(key === 'all' ? {} : { filter: key })}>{label}</button>)}</div>
      {state.loading && <p>正在加载章节…</p>}
      {state.error && <div className="form-feedback form-feedback--error"><p>{state.error.message}</p><button onClick={() => setRetry((value) => value + 1)}>重试</button></div>}
      {!state.loading && !state.error && !state.items.length && <p className="life-empty">这里还没有对应状态的章节。</p>}
      <div className="my-chapter-list">{state.items.map((chapter) => <article key={chapter.id}>
        <div className="my-chapter-list__cover">{chapter.cover_thumbnail_url ? <AdaptiveMedia src={chapter.cover_thumbnail_url} alt={`${chapter.name} 的封面`} fit="cover" /> : <span aria-hidden="true">映</span>}</div>
        <div className="my-chapter-list__body">
          <div className="tag-row"><span>{chapter.contribution_policy === 'private' ? '私有章节' : '公有章节'}</span><span>{reviewLabels[chapter.review_status] || chapter.review_status}</span><span>{statusLabels[chapter.status] || chapter.status}</span></div>
          <h3>{chapter.name}</h3>
          <p>{chapter.content_count} 条日常 · {chapter.contributor_count} 位参与者 · {chapter.child_count} 个子章节</p>
          <small>更新于 {new Date(chapter.updated_at).toLocaleString()}</small>
          {chapter.review_status === 'rejected' && chapter.review_note && <p className="form-feedback form-feedback--error">审核意见：{chapter.review_note}</p>}
          {chapter.status === 'merged' && chapter.merged_into && <p>已合并到 <Link to={`/life/chapter/${chapter.merged_into.slug}`}>{chapter.merged_into.name}</Link></p>}
          <div className="life-toolbar">
            {chapter.status !== 'merged' && <Link className="button" to={`/life/chapters/${chapter.id}/edit`}>编辑</Link>}
            {chapter.can_delete && <button className="button button--danger" onClick={() => setDeleting(chapter)}>删除</button>}
            {chapter.review_status === 'approved' && chapter.status === 'active' && <Link className="button" to={`/life/chapter/${chapter.slug}`}>查看章节</Link>}
          </div>
        </div>
      </article>)}</div>
      {deleting && <ChapterDeleteDialog chapter={deleting} open onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); setRetry((value) => value + 1) }} />}
    </section>
  )
}
