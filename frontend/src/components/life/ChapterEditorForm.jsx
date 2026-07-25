import { useEffect, useRef, useState } from 'react'
import { checkLifeChapterName, getLifeChapters } from '../../api/life.js'
import { deleteUnboundImage } from '../../api/uploads.js'
import ChapterContributionPolicyField from './ChapterContributionPolicyField.jsx'
import ChapterCoverField from './ChapterCoverField.jsx'

const types = { city: '城市', scenic: '景点', travel: '旅行', campus: '校园', event: '活动', custom: '自定义' }

function model(initial) {
  return {
    name: initial?.name || '',
    chapter_type: initial?.chapter_type || 'city',
    parent_id: initial?.parent?.id ? String(initial.parent.id) : '',
    country: initial?.country || '',
    province: initial?.province || '',
    city: initial?.city || '',
    description: initial?.description || '',
    contribution_policy: initial?.contribution_policy || 'public',
    aliases: (initial?.aliases || []).join(','),
    review_note: initial?.review_note || '',
    cover_media_id: initial ? undefined : null,
    cover_url: initial?.cover_thumbnail_url || initial?.cover_url || null,
  }
}

export default function ChapterEditorForm({ initial = null, admin = false, pending = false, requestError = null, submitLabel = '保存章节', onSubmit }) {
  const [form, setForm] = useState(() => model(initial))
  const [parents, setParents] = useState([])
  const [check, setCheck] = useState(null)
  const [localError, setLocalError] = useState(null)
  const uploaded = useRef(new Map())
  const dirty = useRef(false)
  const editing = Boolean(initial)
  const fieldErrors = Object.fromEntries((requestError?.details || []).map((item) => [item.field, item.message]))

  useEffect(() => {
    let cancelled = false
    getLifeChapters({ parent_id: 'root', page_size: 100 }).then((result) => {
      if (!cancelled) setParents(result.data.filter((item) => item.id !== initial?.id))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [initial?.id])

  useEffect(() => () => {
    uploaded.current.forEach((publicId) => { void deleteUnboundImage(publicId).catch(() => {}) })
  }, [])

  useEffect(() => {
    const warn = (event) => {
      if (!dirty.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  useEffect(() => {
    if (editing || !form.name.trim()) return undefined
    let cancelled = false
    const timer = window.setTimeout(() => {
      checkLifeChapterName({ name: form.name, parent_id: form.parent_id || undefined })
        .then((result) => { if (!cancelled) setCheck(result) })
        .catch(() => { if (!cancelled) setCheck(null) })
    }, 350)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [editing, form.name, form.parent_id])

  function update(field, value) {
    dirty.current = true
    setLocalError(null)
    if (field === 'name' || field === 'parent_id') setCheck(null)
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function removeCover() {
    if (form.cover_media_id && uploaded.current.has(form.cover_media_id)) {
      await deleteUnboundImage(uploaded.current.get(form.cover_media_id))
      uploaded.current.delete(form.cover_media_id)
    }
    update('cover_media_id', null)
    setForm((current) => ({ ...current, cover_url: null }))
  }

  async function submit(event) {
    event.preventDefault()
    if (pending) return
    if (!form.name.trim()) { setLocalError('请填写章节名称。'); return }
    if (check?.exact_match) { setLocalError('同层级已经有同名章节。'); return }
    const payload = {
      name: form.name.trim(),
      chapter_type: form.chapter_type,
      parent_id: form.parent_id ? Number(form.parent_id) : null,
      country: form.country.trim() || null,
      province: form.province.trim() || null,
      city: form.city.trim() || null,
      description: form.description.trim() || null,
      contribution_policy: form.contribution_policy,
      ...(form.cover_media_id !== undefined ? { cover_media_id: form.cover_media_id } : {}),
      ...(admin ? {
        aliases: form.aliases.split(',').map((value) => value.trim()).filter(Boolean),
        review_note: form.review_note.trim() || null,
      } : {}),
    }
    await onSubmit(payload)
    dirty.current = false
    uploaded.current.clear()
  }

  return (
    <form className="life-form chapter-editor-form" onSubmit={(event) => void submit(event).catch(() => {})} noValidate>
      <label>名称<input value={form.name} maxLength="80" aria-invalid={Boolean(fieldErrors.name)} onChange={(event) => update('name', event.target.value)} /></label>
      {check?.exact_match && <p className="form-feedback form-feedback--error">同层级已有「{check.exact_match.name}」。</p>}
      {check?.candidates?.length > 0 && <p className="form-feedback">可能相近：{check.candidates.map((item) => item.name).join('、')}</p>}
      {fieldErrors.name && <p className="form-feedback form-feedback--error">{fieldErrors.name}</p>}
      <label>类型<select value={form.chapter_type} onChange={(event) => update('chapter_type', event.target.value)}>{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>父章节（可选）<select value={form.parent_id} aria-invalid={Boolean(fieldErrors.parent_id)} onChange={(event) => update('parent_id', event.target.value)}><option value="">作为一级章节</option>{parents.map((chapter) => <option value={chapter.id} key={chapter.id}>{chapter.name}</option>)}</select></label>
      {fieldErrors.parent_id && <p className="form-feedback form-feedback--error">{fieldErrors.parent_id}</p>}
      <div className="life-form__pair"><label>国家<input value={form.country} maxLength="100" onChange={(event) => update('country', event.target.value)} /></label><label>省份<input value={form.province} maxLength="100" onChange={(event) => update('province', event.target.value)} /></label></div>
      <label>城市<input value={form.city} maxLength="100" onChange={(event) => update('city', event.target.value)} /></label>
      <label>简介<textarea value={form.description} maxLength="500" onChange={(event) => update('description', event.target.value)} /></label>
      <ChapterContributionPolicyField value={form.contribution_policy} onChange={(value) => update('contribution_policy', value)} disabled={pending} error={fieldErrors.contribution_policy} />
      <ChapterCoverField imageUrl={form.cover_url} disabled={pending} error={fieldErrors.cover_media_id} onUploaded={async (media) => {
        if (form.cover_media_id && uploaded.current.has(form.cover_media_id)) {
          await deleteUnboundImage(uploaded.current.get(form.cover_media_id)).catch(() => {})
          uploaded.current.delete(form.cover_media_id)
        }
        uploaded.current.set(media.id, media.public_id)
        update('cover_media_id', media.id)
        setForm((current) => ({ ...current, cover_url: media.thumbnail_url }))
      }} onRemove={removeCover} />
      {admin && <><label>别名（逗号分隔）<input value={form.aliases} onChange={(event) => update('aliases', event.target.value)} /></label><label>审核备注<textarea value={form.review_note} maxLength="1000" onChange={(event) => update('review_note', event.target.value)} /></label></>}
      {(localError || (requestError && !requestError.details?.length)) && <p className="form-feedback form-feedback--error" role="alert">{localError || requestError.message}</p>}
      <button className="button button--primary" disabled={pending || Boolean(check?.exact_match)}>{pending ? '正在保存…' : submitLabel}</button>
    </form>
  )
}
