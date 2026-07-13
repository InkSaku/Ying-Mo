import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteLifePost, getLifePost } from '../api/life.js'
import LifePostGallery from '../components/life/LifePostGallery.jsx'
import InteractionPanel from '../components/interactions/InteractionPanel.jsx'
import ReportButton from '../components/reports/ReportButton.jsx'

const visibilityLabels = { public: '公开可见', login_only: '仅登录用户可见', private: '仅自己可见' }

function dateText(value, withTime = false) {
  if (!value) return ''
  return new Intl.DateTimeFormat('zh-CN', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'long' }).format(new Date(value))
}

export default function LifePostDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState({ key: null, post: null, error: null })
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
    if (!state.post || deleting || !window.confirm('确认删除这篇日常吗？删除后无法恢复。')) return
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

  const loading = state.key !== requestKey
  const error = loading ? null : state.error
  if (loading) return <section className="life-page page-container"><p className="state-message">正在加载这篇日常…</p></section>
  if (error) return <section className="life-page page-container"><div className="state-message state-message--error"><p>{error.status === 404 ? '没有找到这篇日常。' : error.message}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>重新加载</button></div></section>

  const post = state.post
  return (
    <article className="life-detail page-container">
      <LifePostGallery images={post.images} title={post.title} />
      <div className="life-detail__heading">
        <p className="eyebrow"><Link to={`/life/chapter/${post.chapter.slug}`}>{post.chapter.name}</Link></p>
        <h1>{post.title}</h1>
        <p className="life-detail__author">来自 <Link to={`/user/${post.author.username}`}>{post.author.nickname}</Link> · 发布于 {dateText(post.created_at, true)}</p>
      </div>
      {post.body && <p className="life-detail__body">{post.body}</p>}
      <dl className="life-facts life-facts--post">
        {post.shot_at && <div><dt>拍摄时间</dt><dd>{dateText(post.shot_at, true)}</dd></div>}
        {post.location && <div><dt>地点</dt><dd>{post.location}</dd></div>}
        {post.mood && <div><dt>心情</dt><dd>{post.mood}</dd></div>}
        <div><dt>可见范围</dt><dd>{visibilityLabels[post.visibility] || post.visibility}</dd></div>
      </dl>
      {post.tags.length > 0 && <div className="tag-row">{post.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
      <div className="life-toolbar">{post.can_edit && <><Link className="button" to={`/life/post/${post.id}/edit`}>编辑日常</Link><button type="button" className="button--danger" disabled={deleting} onClick={() => void remove()}>{deleting ? '正在删除…' : '删除日常'}</button></>}<ReportButton targetType="life_post" targetId={post.id} /></div>
      {deleteError && <p className="form-feedback form-feedback--error" role="alert">{deleteError.message}</p>}
      <InteractionPanel targetType="life_post" targetId={post.id} />
    </article>
  )
}
