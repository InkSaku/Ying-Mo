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
    }
  }

  async function saveDraft(payload, mediaIds) {
    setPending(true)
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
        <p className="eyebrow">发布内容 · 第一步</p>
        <h1>先选择一个合集</h1>
        <p>内容会归入所选合集。公开可见不代表允许投稿，这里只列出你确实有发布权限的合集。</p>
        <LifeCollectionPicker collections={collections} onSelect={changeCollection} />
        <div className="life-toolbar"><Link className="button" to="/life/chapters/create">创建新合集</Link></div>
      </section>
    )
  }

  return (
    <section className="life-page life-editor-page page-container">
      <Link className="text-link" to="/life">返回生活区</Link>
      <p className="eyebrow">发布内容 · {edit ? '编辑' : '第二步'}</p>
      <h1>{edit ? '编辑生活内容' : '记录这一刻'}</h1>
      <p>{edit ? 'Markdown 正文、媒体和视频链接可以自由组合，保存时会再次检查合集权限。' : '用 Markdown 写下正文，再按需添加图片、Live Photo 或外部视频链接。'}</p>
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
        requestError={submitError}
      />
    </section>
  )
}
