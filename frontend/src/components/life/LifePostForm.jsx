import { useEffect, useState } from 'react'
import { getLifeChapters } from '../../api/life.js'
import LifeImageManager from './LifeImageManager.jsx'

function localDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

async function loadChapters() {
  const all = []
  let page = 1
  let hasNext = true
  while (hasNext) {
    const result = await getLifeChapters({ page, page_size: 100, sort: 'latest' })
    all.push(...result.data)
    hasNext = result.meta.pagination.has_next
    page += 1
  }
  return all
}

function defaultForm(chapterId) {
  return { title: '', body: '', chapter_id: chapterId || '', location: '', mood: '', tags: [], shot_at: '', visibility: 'public' }
}

export default function LifePostForm({ initial, chapterId, preserveCurrentChapterId = null, onSubmit, onSaveDraft, protectedMediaIds = [], pending, requestError }) {
  const [form, setForm] = useState(() => initial || defaultForm(chapterId))
  const [images, setImages] = useState(() => initial?.images || [])
  const [tag, setTag] = useState('')
  const [chapters, setChapters] = useState([])
  const [chaptersError, setChaptersError] = useState(null)
  const [chaptersLoaded, setChaptersLoaded] = useState(false)
  const [localError, setLocalError] = useState(null)
  const fieldErrors = Object.fromEntries((requestError?.details || []).map((item) => [item.field, item.message]))

  useEffect(() => {
    let cancelled = false
    loadChapters().then((items) => {
      if (!cancelled) { setChapters(items); setChaptersLoaded(true) }
    }).catch((error) => {
      if (!cancelled) { setChaptersError(error); setChaptersLoaded(true) }
    })
    return () => { cancelled = true }
  }, [])

  function update(field, value) {
    setLocalError(null)
    setForm((current) => ({ ...current, [field]: value }))
  }
  function addTag() {
    const value = tag.trim()
    if (!value) return
    if (value.length > 20 || form.tags.length >= 10 || form.tags.includes(value)) {
      setLocalError('标签最多 10 个、每个不超过 20 字，且不能重复。')
      return
    }
    setForm((current) => ({ ...current, tags: [...current.tags, value] }))
    setTag('')
  }
  function submit(event) {
    event.preventDefault()
    if (!chaptersLoaded) return setLocalError('正在确认章节投稿权限，请稍候。')
    if (!form.title.trim() || form.title.trim().length > 100) return setLocalError('请填写不超过 100 字的标题。')
    if (!form.chapter_id) return setLocalError('请选择一个生活章节。')
    const selectedChapter = chapters.find((chapter) => String(chapter.id) === String(form.chapter_id))
    const keepsCurrentChapter = preserveCurrentChapterId && String(form.chapter_id) === String(preserveCurrentChapterId)
    if (chaptersLoaded && !selectedChapter?.can_post && !keepsCurrentChapter) return setLocalError('该章节已不再允许你投稿，请重新选择章节。')
    if (!images.length) return setLocalError('请至少添加一张照片或实况。')
    if (images.filter((item) => item.media_type === 'live_video').length > 3) return setLocalError('每篇日常最多添加 3 个实况。')
    if (images.length > 9 || images.some((image) => image.uploading || image.processing || image.error || !Number.isInteger(image.id))) return setLocalError('请等待媒体上传和处理完成，并处理失败的项目。')
    onSubmit({
      title: form.title.trim(), body: form.body || null, chapter_id: Number(form.chapter_id), location: form.location || null,
      mood: form.mood || null, tags: form.tags, shot_at: form.shot_at ? new Date(form.shot_at).toISOString() : null,
      visibility: form.visibility, media_ids: images.map((image) => image.id),
    })
  }
  function saveDraft() {
    const payload = { ...form, chapter_id: form.chapter_id ? Number(form.chapter_id) : null, shot_at: form.shot_at ? new Date(form.shot_at).toISOString() : null }
    onSaveDraft?.(payload, images.filter((image) => Number.isInteger(image.id)).map((image) => image.id))
  }

  const currentId = preserveCurrentChapterId ? Number(preserveCurrentChapterId) : null
  const keepsCurrentChapter = currentId && String(form.chapter_id) === String(currentId)
  const invalidChapterSelection = Boolean(chaptersLoaded && form.chapter_id && !keepsCurrentChapter && !chapters.some((chapter) => String(chapter.id) === String(form.chapter_id) && chapter.can_post))
  const allowed = chapters.filter((chapter) => chapter.can_post || chapter.id === currentId)
  if (currentId && !allowed.some((chapter) => chapter.id === currentId) && initial?.chapter) {
    allowed.push({ ...initial.chapter, can_post: false, contribution_policy: initial.chapter.contribution_policy || 'private' })
  }
  const roots = allowed.filter((chapter) => !chapter.parent)
  const children = allowed.filter((chapter) => chapter.parent)
  return (
    <form className="life-form" onSubmit={submit} noValidate>
      <label>标题<input value={form.title} maxLength="100" aria-invalid={Boolean(fieldErrors.title)} onChange={(event) => update('title', event.target.value)} /></label>
      {fieldErrors.title && <p className="form-feedback form-feedback--error">{fieldErrors.title}</p>}
      <label>章节
        <select value={form.chapter_id} aria-invalid={Boolean(fieldErrors.chapter_id)} onChange={(event) => update('chapter_id', event.target.value)}>
          <option value="">选择章节</option>
          {roots.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.name}{chapter.id === currentId && !chapter.can_post ? '（当前章节，仅保留现有内容）' : ''}</option>)}
          {children.map((chapter) => <option key={chapter.id} value={chapter.id}>└ {chapter.parent.name} · {chapter.name}{chapter.id === currentId && !chapter.can_post ? '（当前章节，仅保留现有内容）' : ''}</option>)}
        </select>
      </label>
      {currentId && allowed.some((chapter) => chapter.id === currentId && !chapter.can_post) && <p className="form-feedback">当前章节已不再接受你的新投稿；不更换章节仍可保存这篇已有日常。</p>}
      {chaptersError && <p className="form-feedback form-feedback--error">章节暂时无法加载：{chaptersError.message}</p>}
      {invalidChapterSelection && <p className="form-feedback form-feedback--error">该章节已不再允许你投稿，请重新选择章节。</p>}
      {fieldErrors.chapter_id && <p className="form-feedback form-feedback--error">{fieldErrors.chapter_id}</p>}
      <label>正文<textarea rows="6" value={form.body || ''} maxLength="5000" onChange={(event) => update('body', event.target.value)} /></label>
      <div className="life-form__pair"><label>地点<input value={form.location || ''} maxLength="100" onChange={(event) => update('location', event.target.value)} /></label><label>心情<input value={form.mood || ''} maxLength="30" onChange={(event) => update('mood', event.target.value)} /></label></div>
      <label>拍摄时间<input type="datetime-local" value={localDateTime(form.shot_at)} onChange={(event) => update('shot_at', event.target.value)} /></label>
      <label>可见范围<select value={form.visibility} onChange={(event) => update('visibility', event.target.value)}><option value="public">公开</option><option value="login_only">仅登录用户</option><option value="private">仅自己</option></select></label>
      <div className="tag-input"><input value={tag} maxLength="20" placeholder="输入标签后按回车" onChange={(event) => setTag(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag() } }} /><button type="button" onClick={addTag}>添加标签</button>{form.tags.map((item) => <button type="button" key={item} onClick={() => setForm((current) => ({ ...current, tags: current.tags.filter((name) => name !== item) }))}>{item} ×</button>)}</div>
      <LifeImageManager value={images} onChange={setImages} existingIds={[...(initial?.images.map((image) => image.id) || []), ...protectedMediaIds]} disabled={pending} />
      {(localError || fieldErrors.media_ids) && <p className="form-feedback form-feedback--error" role="alert">{localError || fieldErrors.media_ids}</p>}
      {requestError && !requestError.details?.length && <p className="form-feedback form-feedback--error" role="alert">{requestError.message}</p>}
      <div className="life-form__actions">{onSaveDraft && <button type="button" disabled={pending} onClick={saveDraft}>{pending ? '正在保存…' : '保存草稿'}</button>}<button className="button button--primary" disabled={pending || !chaptersLoaded}>{pending ? '正在保存…' : chaptersLoaded ? '发布日常' : '正在确认章节…'}</button></div>
    </form>
  )
}
