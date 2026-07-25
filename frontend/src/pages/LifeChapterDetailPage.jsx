import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getLifeChapter, getLifePosts } from '../api/life.js'
import { useAuth } from '../auth/useAuth.js'
import AdaptiveMedia from '../components/common/AdaptiveMedia.jsx'
import ChapterDeleteDialog from '../components/life/ChapterDeleteDialog.jsx'
import LifePostCard from '../components/life/LifePostCard.jsx'
import Pagination from '../components/life/Pagination.jsx'

const typeLabels = { city: '城市章节', scenic: '景点章节', travel: '旅行章节', campus: '校园章节', event: '活动章节', custom: '生活章节' }

export default function LifeChapterDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const pageValue = Number(searchParams.get('page') || 1)
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1
  const [chapterState, setChapterState] = useState({ key: null, chapter: null, error: null })
  const [postsState, setPostsState] = useState({ key: null, posts: [], pagination: null, error: null })
  const [retry, setRetry] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const chapterKey = `${slug}:${retry}`
  const postsKey = `${slug}:${page}:${retry}`

  useEffect(() => {
    let cancelled = false
    getLifeChapter(slug)
      .then((chapter) => !cancelled && setChapterState({ key: chapterKey, chapter, error: null }))
      .catch((error) => !cancelled && setChapterState({ key: chapterKey, chapter: null, error }))
    return () => { cancelled = true }
  }, [slug, retry, chapterKey])
  useEffect(() => {
    const canonical = chapterState.chapter?.canonical_slug
    if (canonical) navigate(`/life/chapter/${canonical}`, { replace: true })
  }, [chapterState.chapter, navigate])
  useEffect(() => {
    let cancelled = false
    getLifePosts({ chapter_slug: slug, page, page_size: 12 })
      .then((result) => !cancelled && setPostsState({ key: postsKey, posts: result.data, pagination: result.meta.pagination, error: null }))
      .catch((error) => !cancelled && setPostsState({ key: postsKey, posts: [], pagination: null, error }))
    return () => { cancelled = true }
  }, [slug, page, retry, postsKey])

  const chapterLoading = chapterState.key !== chapterKey
  const chapterError = chapterLoading ? null : chapterState.error
  const postsLoading = postsState.key !== postsKey
  const postsError = postsLoading ? null : postsState.error
  const posts = postsLoading ? [] : postsState.posts
  const pagination = postsLoading ? null : postsState.pagination
  if (chapterLoading) return <section className="life-page page-container"><p className="state-message">正在打开章节…</p></section>
  if (chapterError) return <section className="life-page page-container"><div className="state-message state-message--error"><p>{chapterError.status === 404 ? '没有找到这个章节。' : chapterError.message}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>重新加载</button></div></section>

  const chapter = chapterState.chapter
  if (chapter.canonical_slug) return <section className="life-page page-container"><p className="state-message">正在前往合并后的章节…</p></section>
  const location = [chapter.country, chapter.province, chapter.city].filter(Boolean).join(' · ')
  const admin = ['content_admin', 'system_admin'].includes(user?.role)
  return (
    <section className="life-page page-container">
      <div className="chapter-hero">
        {chapter.cover_url ? <div className="chapter-hero__media"><AdaptiveMedia src={chapter.cover_url} alt={`${chapter.name} 的章节封面`} fit="contain" loading="eager" /></div> : <div className="chapter-hero__placeholder" aria-hidden="true">映</div>}
        <div>
          <div className="tag-row"><span>{typeLabels[chapter.chapter_type]}</span><span>{chapter.contribution_policy === 'private' ? '私有章节' : '公有章节'}</span></div>
          <h1>{chapter.name}</h1>
          {chapter.description && <p>{chapter.description}</p>}
          <dl className="life-facts">
            {location && <div><dt>地区</dt><dd>{location}</dd></div>}
            <div><dt>创建者</dt><dd><Link to={`/user/${chapter.creator.username}`}>{chapter.creator.nickname}</Link></dd></div>
            <div><dt>收录日常</dt><dd>{chapter.content_count} 条</dd></div>
            <div><dt>参与者</dt><dd>{chapter.contributor_count} 位</dd></div>
          </dl>
          {chapter.contribution_policy === 'private' && !chapter.is_owner && <p className="chapter-policy-note">所有人可浏览，仅章节创建者可投稿。</p>}
          {!chapter.can_post && chapter.contribution_policy === 'public' && <p className="chapter-policy-note">登录且账号具有发布权限后，可以向这个公有章节投稿。</p>}
          <div className="life-toolbar">
            {chapter.can_post && <Link className="button button--primary" to={`/life/create?chapter=${chapter.id}`}>发布到此章节</Link>}
            {chapter.can_edit && <Link className="button" to={admin ? `/admin/chapters/${chapter.id}/edit` : `/life/chapters/${chapter.id}/edit`}>编辑章节</Link>}
            {chapter.can_delete && <button className="button button--danger" type="button" onClick={() => setDeleting(true)}>删除章节</button>}
            {chapter.parent && <Link className="button" to={`/life/chapter/${chapter.parent.slug}`}>返回 {chapter.parent.name}</Link>}
          </div>
        </div>
      </div>
      {chapter.children?.length > 0 && <section className="chapter-children"><h2>子章节</h2><div className="tag-row">{chapter.children.map((child) => <Link key={child.id} to={`/life/chapter/${child.slug}`}>{child.name} · {child.content_count} 条</Link>)}</div></section>}
      <section className="life-section">
        <div className="life-section__heading"><div><p className="eyebrow">章节日常</p><h2>{chapter.name} 的直接记录</h2></div></div>
        {postsLoading && <p className="state-message">正在加载日常…</p>}
        {postsError && <div className="state-message state-message--error"><p>{postsError.message}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>重新加载</button></div>}
        {!postsLoading && !postsError && posts.length === 0 && <p className="life-empty">这个章节还没有直接收录的日常，留下第一张照片吧。</p>}
        {!postsLoading && !postsError && posts.length > 0 && <div className="card-grid card-grid--three">{posts.map((post) => <LifePostCard key={post.id} post={post} />)}</div>}
        <Pagination pagination={pagination} onPageChange={(nextPage) => setSearchParams({ page: String(nextPage) })} />
      </section>
      <ChapterDeleteDialog chapter={chapter} admin={admin} open={deleting} onClose={() => setDeleting(false)} onDeleted={(result) => navigate(result.mode === 'merged' ? `/life/chapter/${result.canonical_slug}` : '/me/chapters', { replace: true })} />
    </section>
  )
}
