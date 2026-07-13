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

export default function LifePostForm({ initial, chapterId, onSubmit, onSaveDraft, protectedMediaIds = [], pending, requestError }) {
  const [form, setForm] = useState(() => initial || defaultForm(chapterId))
  const [images, setImages] = useState(() => initial?.images || [])
  const [tag, setTag] = useState('')
  const [chapters, setChapters] = useState([])
  const [chaptersError, setChaptersError] = useState(null)
  const [localError, setLocalError] = useState(null)
  const fieldErrors = Object.fromEntries((requestError?.details || []).map((item) => [item.field, item.message]))

  useEffect(() => {
    let cancelled = false
    loadChapters().then((items) => !cancelled && setChapters(items)).catch((error) => !cancelled && setChaptersError(error))
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
    if (!form.title.trim() || form.title.trim().length > 100) return setLocalError('请填写不超过 100 字的标题。')
    if (!form.chapter_id) return setLocalError('请选择一个生活章节。')
    if (!images.length) return setLocalError('请至少添加一张图片。')
    if (images.length > 9 || images.some((image) => image.uploading || image.error || !Number.isInteger(image.id))) return setLocalError('请等待图片上传完成，并处理上传失败的图片。')
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

  const roots = chapters.filter((chapter) => !chapter.parent)
  const children = chapters.filter((chapter) => chapter.parent)
  return (
    <form className="life-form" onSubmit={submit} noValidate>
      <label>标题<input value={form.title} maxLength="100" aria-invalid={Boolean(fieldErrors.title)} onChange={(event) => update('title', event.target.value)} /></label>
      {fieldErrors.title && <p className="form-feedback form-feedback--error">{fieldErrors.title}</p>}
      <label>章节
        <select value={form.chapter_id} aria-invalid={Boolean(fieldErrors.chapter_id)} onChange={(event) => update('chapter_id', event.target.value)}>
          <option value="">选择章节</option>
          {roots.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.name}</option>)}
          {children.map((chapter) => <option key={chapter.id} value={chapter.id}>└ {chapter.parent.name} · {chapter.name}</option>)}
        </select>
      </label>
      {chaptersError && <p className="form-feedback form-feedback--error">章节暂时无法加载：{chaptersError.message}</p>}
      {fieldErrors.chapter_id && <p className="form-feedback form-feedback--error">{fieldErrors.chapter_id}</p>}
      <label>正文<textarea rows="6" value={form.body || ''} maxLength="5000" onChange={(event) => update('body', event.target.value)} /></label>
      <div className="life-form__pair"><label>地点<input value={form.location || ''} maxLength="100" onChange={(event) => update('location', event.target.value)} /></label><label>心情<input value={form.mood || ''} maxLength="30" onChange={(event) => update('mood', event.target.value)} /></label></div>
      <label>拍摄时间<input type="datetime-local" value={localDateTime(form.shot_at)} onChange={(event) => update('shot_at', event.target.value)} /></label>
      <label>可见范围<select value={form.visibility} onChange={(event) => update('visibility', event.target.value)}><option value="public">公开</option><option value="login_only">仅登录用户</option><option value="private">仅自己</option></select></label>
      <div className="tag-input"><input value={tag} maxLength="20" placeholder="输入标签后按回车" onChange={(event) => setTag(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag() } }} /><button type="button" onClick={addTag}>添加标签</button>{form.tags.map((item) => <button type="button" key={item} onClick={() => setForm((current) => ({ ...current, tags: current.tags.filter((name) => name !== item) }))}>{item} ×</button>)}</div>
      <LifeImageManager value={images} onChange={setImages} existingIds={[...(initial?.images.map((image) => image.id) || []), ...protectedMediaIds]} disabled={pending} />
      {(localError || fieldErrors.media_ids) && <p className="form-feedback form-feedback--error" role="alert">{localError || fieldErrors.media_ids}</p>}
      {requestError && !requestError.details?.length && <p className="form-feedback form-feedback--error" role="alert">{requestError.message}</p>}
      <div className="life-form__actions">{onSaveDraft && <button type="button" disabled={pending} onClick={saveDraft}>{pending ? '正在保存…' : '保存草稿'}</button>}<button className="button button--primary" disabled={pending}>{pending ? '正在保存…' : '发布日常'}</button></div>
    </form>
  )
}
