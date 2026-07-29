import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteLifePost, getLifePost } from '../api/life.js'
import InteractionPanel from '../components/interactions/InteractionPanel.jsx'
import LifePostDeleteDialog from '../components/life/LifePostDeleteDialog.jsx'
import LifePostGallery from '../components/life/LifePostGallery.jsx'
import MarkdownContent from '../components/life/MarkdownContent.jsx'
import ReportButton from '../components/reports/ReportButton.jsx'
import { inlineMediaPublicIds } from '../utils/lifeMedia.js'

const visibilityLabels = { public: '公开可见', login_only: '仅登录用户可见', private: '仅自己可见' }

function dateText(value, withTime = false) {
  if (!value) return ''
  return new Intl.DateTimeFormat('zh-CN', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'long' }).format(new Date(value))
}

function videoHost(value) {
  try {
    return new URL(value).hostname
  } catch {
    return '外部网站'
  }
}

export default function LifePostDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState({ key: null, post: null, error: null })
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [retry, setRetry] = useState(0)
  const requestKey = `${id}:${retry}`

  useEffect(() => {
    let cancelled = false
    getLifePost(id)
      .then((post) => !cancelled && setState({ key: requestKey, post, error: null }))
      .catch((error) => !cancelled && setState({ key: requestKey, post: null, error }))
    return () => { cancelled = true }
  }, [id, retry, requestKey])

  async function remove() {
    if (!state.post || deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteLifePost(state.post.id)
      navigate('/life')
    } catch (error) {
      setDeleteError(error)
      setDeleting(false)
    }
  }

  function openDeleteDialog() {
    setDeleteError(null)
    setDeleteDialogOpen(true)
  }

  const loading = state.key !== requestKey
  const error = loading ? null : state.error
  if (loading) return <section className="life-page page-container"><p className="state-message">正在加载这篇内容…</p></section>
  if (error) return <section className="life-page page-container"><div className="state-message state-message--error"><p>{error.status === 404 ? '没有找到这篇内容。' : error.message}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>重新加载</button></div></section>

  const post = state.post
  const mediaTitle = post.title || '无标题生活内容'
  const inlineMediaIds = new Set(inlineMediaPublicIds(post.body || '').map((value) => value.toLowerCase()))
  const legacyMedia = (post.images || []).filter(
    (item) => (
      item.id !== post.cover_media_id
      && !inlineMediaIds.has(String(item.public_id || '').toLowerCase())
    ),
  )
  return (
    <article className="life-detail page-container">
      <LifePostGallery cover={post.cover_media} images={legacyMedia} title={mediaTitle} />
      <div className="life-detail__heading">
        <p className="eyebrow"><Link to={`/life/chapter/${post.chapter.slug}`}>{post.chapter.name}</Link></p>
        {post.title && <h1>{post.title}</h1>}
        <p className="life-detail__author">来自 <Link to={`/user/${post.author.username}`}>{post.author.nickname}</Link> · 发布于 {dateText(post.created_at, true)}</p>
      </div>
      {post.body && (
        post.content_format === 'markdown'
          ? <MarkdownContent className="life-detail__body" media={post.images || []} title={mediaTitle}>{post.body}</MarkdownContent>
          : <div className="life-detail__body life-detail__body--plain">{post.body}</div>
      )}
      {post.external_video_url && (
        <aside className="life-external-video">
          <span className="life-external-video__icon" aria-hidden="true">▶</span>
          <div><strong>外部视频</strong><small>链接来自 {videoHost(post.external_video_url)}，点击后将在新窗口打开。</small></div>
          <a className="button button--primary" href={post.external_video_url} target="_blank" rel="noopener noreferrer">打开视频</a>
        </aside>
      )}
      {(post.shot_at || post.location || post.mood || post.visibility) && (
        <dl className="life-facts life-facts--post">
          {post.shot_at && <div><dt>拍摄或发生时间</dt><dd>{dateText(post.shot_at, true)}</dd></div>}
          {post.location && <div><dt>地点</dt><dd>{post.location}</dd></div>}
          {post.mood && <div><dt>心情</dt><dd>{post.mood}</dd></div>}
          {post.visibility && <div><dt>可见范围</dt><dd>{visibilityLabels[post.visibility] || post.visibility}</dd></div>}
        </dl>
      )}
      {post.tags?.length > 0 && <div className="tag-row">{post.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
      <div className="life-toolbar">
        {post.can_edit && <><Link className="button" to={`/life/post/${post.id}/edit`}>编辑内容</Link><button type="button" className="button--danger" onClick={openDeleteDialog}>删除内容</button></>}
        <ReportButton targetType="life_post" targetId={post.id} />
      </div>
      <InteractionPanel targetType="life_post" targetId={post.id} animated />
      <LifePostDeleteDialog
        post={post}
        open={deleteDialogOpen}
        pending={deleting}
        error={deleteError}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => void remove()}
      />
    </article>
  )
}
