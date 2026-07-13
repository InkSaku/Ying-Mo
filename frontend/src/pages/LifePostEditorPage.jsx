import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { createLifePost, getLifePost, updateLifePost } from '../api/life.js'
import { createDraft, getDraft, updateDraft } from '../api/drafts.js'
import LifePostForm from '../components/life/LifePostForm.jsx'

function editorModel(post) {
  return {
    title: post.title || '',
    body: post.body || '',
    chapter_id: post.chapter?.id || '',
    location: post.location || '',
    mood: post.mood || '',
    tags: post.tags || [],
    shot_at: post.shot_at || '',
    visibility: post.visibility || 'public',
    images: post.images || [],
  }
}

export default function LifePostEditorPage({ edit = false }) {
  const { id } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const [initial, setInitial] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [submitError, setSubmitError] = useState(null)
  const [pending, setPending] = useState(false)
  const [draftId, setDraftId] = useState(() => edit ? null : search.get('draft'))
  const [draftNotice, setDraftNotice] = useState(null)
  const [protectedMediaIds, setProtectedMediaIds] = useState([])

  useEffect(() => {
    if (!edit) return undefined
    let cancelled = false
    getLifePost(id).then((post) => {
      if (!cancelled) setInitial(editorModel(post))
    }).catch((error) => {
      if (!cancelled) setLoadError(error)
    })
    return () => { cancelled = true }
  }, [edit, id])

  useEffect(() => {
    if (edit || !draftId) return undefined
    let cancelled = false
    getDraft(draftId).then((draft) => {
      if (draft.draft_type !== 'life_post') throw new Error('草稿类型不匹配。')
      if (!cancelled) { setInitial({ ...editorModel(draft.payload), images: draft.media || [] }); setProtectedMediaIds((draft.media || []).map((item) => item.id)) }
    }).catch((error) => { if (!cancelled) setLoadError(error) })
    return () => { cancelled = true }
  }, [draftId, edit])

  async function submit(payload) {
    setPending(true)
    setSubmitError(null)
    try {
      const post = edit ? await updateLifePost(id, payload) : await createLifePost(draftId ? { ...payload, draft_id: Number(draftId) } : payload)
      navigate(`/life/post/${post.id}`)
    } catch (error) {
      setSubmitError(error)
    } finally {
      setPending(false)
    }
  }

  async function saveDraft(payload, mediaIds) {
    setPending(true)
    setSubmitError(null)
    try {
      const draft = draftId ? await updateDraft(draftId, { payload, media_ids: mediaIds }) : await createDraft({ draft_type: 'life_post', payload, media_ids: mediaIds })
      setDraftId(String(draft.id))
      setProtectedMediaIds(mediaIds)
      setDraftNotice('草稿已保存。')
    } catch (error) { setSubmitError(error) } finally { setPending(false) }
  }

  if ((edit || draftId) && !initial && !loadError) return <section className="life-page page-container"><p className="state-message">正在加载日常…</p></section>
  if (loadError) return <section className="life-page page-container"><p className="state-message state-message--error">{loadError.status === 404 ? '没有找到这篇日常。' : loadError.message}</p></section>
  return (
    <section className="life-page page-container">
      <Link className="text-link" to="/life">返回日常</Link>
      <h1>{edit ? '编辑日常' : '发布日常'}</h1>
      <p>{edit ? '修改后会保留没有移除的照片，并按当前顺序更新。' : '一张照片、一段文字，把今天留在这里。'}</p>
      {draftNotice && <p className="form-feedback form-feedback--success">{draftNotice}</p>}
      <LifePostForm key={edit ? `edit-${id}` : initial ? `draft-${draftId}` : `new-${search.get('chapter') || ''}`} initial={initial} chapterId={search.get('chapter')} onSubmit={submit} onSaveDraft={edit ? null : saveDraft} protectedMediaIds={protectedMediaIds} pending={pending} requestError={submitError} />
    </section>
  )
}
