import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { createLifePost, getLifePost, getPostableLifeChapters, updateLifePost } from '../api/life.js'
import { createDraft, getDraft, updateDraft } from '../api/drafts.js'
import LifeCollectionPicker from '../components/life/LifeCollectionPicker.jsx'
import LifePostForm from '../components/life/LifePostForm.jsx'

function editorModel(post) {
  return {
    title: post.title || '',
    body: post.body || '',
    content_format: post.content_format || 'plain',
    external_video_url: post.external_video_url || '',
    cover_media_id: post.cover_media_id || null,
    chapter_id: post.chapter?.id || post.chapter_id || '',
    chapter: post.chapter || null,
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
  const requestedCollectionId = search.get('chapter_id') || search.get('chapter')
  const [initial, setInitial] = useState(null)
  const [collections, setCollections] = useState(null)
  const [chosenCollection, setChosenCollection] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [submitError, setSubmitError] = useState(null)
  const [pending, setPending] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [draftId, setDraftId] = useState(() => edit ? null : search.get('draft'))
  const [draftNotice, setDraftNotice] = useState(null)
  const [protectedMediaIds, setProtectedMediaIds] = useState([])

  useEffect(() => {
    let cancelled = false
    getPostableLifeChapters()
      .then((result) => !cancelled && setCollections(result))
      .catch((error) => !cancelled && setLoadError(error))
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!edit) return undefined
    let cancelled = false
    getLifePost(id)
      .then((post) => !cancelled && setInitial(editorModel(post)))
      .catch((error) => !cancelled && setLoadError(error))
    return () => { cancelled = true }
  }, [edit, id])

  useEffect(() => {
    if (edit || !draftId) return undefined
    let cancelled = false
    getDraft(draftId)
      .then((draft) => {
        if (draft.draft_type !== 'life_post') throw new Error('草稿类型不匹配。')
        if (!cancelled) {
          setInitial({ ...editorModel(draft.payload), images: draft.media || [] })
          setProtectedMediaIds((draft.media || []).map((item) => item.id))
        }
      })
      .catch((error) => !cancelled && setLoadError(error))
    return () => { cancelled = true }
  }, [draftId, edit])

  const allCollections = useMemo(
    () => collections ? [...collections.owned, ...collections.contributing] : [],
    [collections],
  )

  const targetCollectionId = initial?.chapter_id || requestedCollectionId
  const allowedCollection = targetCollectionId
    ? allCollections.find((item) => String(item.id) === String(targetCollectionId))
    : null
  const existingCollection = edit
    && initial?.chapter
    && String(initial.chapter.id) === String(targetCollectionId)
    ? { ...initial.chapter, can_post: false }
    : null
  const selectedCollection = chosenCollection || allowedCollection || existingCollection
  const invalidRequestedCollection = Boolean(
    collections
    && requestedCollectionId
    && (!draftId || initial)
    && !selectedCollection,
  )

  function changeCollection(collection) {
    setChosenCollection(collection)
    setSubmitError(null)
    if (!edit) {
      const next = new URLSearchParams(search)
      next.delete('chapter')
      next.set('chapter_id', String(collection.id))
      navigate(`/life/create?${next.toString()}`, { replace: true })
    }
  }

  async function submit(payload) {
    setPending(true)
    setPendingAction('publish')
    setSubmitError(null)
    try {
      const post = edit
        ? await updateLifePost(id, payload)
        : await createLifePost(draftId ? { ...payload, draft_id: Number(draftId) } : payload)
      navigate(`/life/post/${post.id}`)
    } catch (error) {
      setSubmitError(error)
    } finally {
      setPending(false)
      setPendingAction(null)
    }
  }

  async function saveDraft(payload, mediaIds) {
    setPending(true)
    setPendingAction('draft')
    setSubmitError(null)
    try {
      const draft = draftId
        ? await updateDraft(draftId, { payload, media_ids: mediaIds })
        : await createDraft({ draft_type: 'life_post', payload, media_ids: mediaIds })
      setDraftId(String(draft.id))
      setProtectedMediaIds(mediaIds)
      setDraftNotice('草稿已保存。')
    } catch (error) {
      setSubmitError(error)
    } finally {
      setPending(false)
      setPendingAction(null)
    }
  }

  const waitingForContent = (edit || draftId) && !initial
  if ((!collections || waitingForContent) && !loadError) {
    return <section className="life-page page-container"><p className="state-message">正在准备内容编辑器…</p></section>
  }
  if (loadError) {
    return <section className="life-page page-container"><div className="state-message state-message--error"><p>{loadError.status === 404 ? '没有找到这篇内容。' : loadError.message}</p><Link className="button" to="/life/create">重新选择合集</Link></div></section>
  }
  if (invalidRequestedCollection) {
    return <section className="life-page page-container"><div className="state-message state-message--error"><p>这个合集不存在，或你当前没有投稿权限。</p><Link className="button" to="/life/create">重新选择合集</Link></div></section>
  }
  if (!selectedCollection) {
    return (
      <section className="life-page life-create-flow page-container">
        <Link className="text-link" to="/life">返回生活区</Link>
        <p className="eyebrow">写日常 · 先找归处</p>
        <h1>这段日子，收进哪里？</h1>
        <p>选择一个合集，让相近的照片与故事在同一处相遇。这里只显示你可以投稿的合集。</p>
        <LifeCollectionPicker collections={collections} onSelect={changeCollection} />
        <div className="life-toolbar"><Link className="button" to="/life/chapters/create">创建新合集</Link></div>
      </section>
    )
  }

  return (
    <section className="life-page life-editor-page page-container">
      <Link className="text-link" to="/life">返回生活区</Link>
      <p className="eyebrow">写日常 · {edit ? '添改' : '落笔'}</p>
      <h1>{edit ? '把这段日常再写一写' : '记录这一刻'}</h1>
      <p>{edit ? '文字、照片、实况与外部视频都可以继续添改，保存后仍会回到原来的合集。' : '从一句话或一张照片开始；想写得很长也可以。地点、心情与时间，都不必勉强留下。'}</p>
      {draftNotice && <p className="form-feedback form-feedback--success">{draftNotice}</p>}
      <LifePostForm
        key={edit ? `edit-${id}` : initial ? `draft-${draftId}` : `new-${selectedCollection.id}`}
        initial={initial}
        selectedCollection={selectedCollection}
        collections={collections}
        onCollectionChange={changeCollection}
        onSubmit={submit}
        onSaveDraft={edit ? null : saveDraft}
        protectedMediaIds={protectedMediaIds}
        pending={pending}
        pendingAction={pendingAction}
        statusMessage={draftNotice}
        requestError={submitError}
      />
    </section>
  )
}
