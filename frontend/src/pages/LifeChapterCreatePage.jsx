/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { checkLifeChapterName, createLifeChapter, getLifeChapters, resubmitLifeChapter } from '../api/life.js'
import { getMyChapterSubmission } from '../api/users.js'
import { deleteUnboundImage } from '../api/uploads.js'
import ImageUploadField from '../components/upload/ImageUploadField.jsx'

const types = { city: '城市', scenic: '景点', travel: '旅行', campus: '校园', event: '活动', custom: '自定义' }

export default function LifeChapterCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const resubmitId = searchParams.get('resubmit')
  const coverPublicIdRef = useRef(null)
  const [form, setForm] = useState({ name: '', chapter_type: 'city', parent_id: '', country: '', province: '', city: '', description: '', cover_media_id: null, cover_url: null, cover_public_id: null })
  const [parents, setParents] = useState([])
  const [check, setCheck] = useState(null)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)
  const fieldErrors = Object.fromEntries((error?.details || []).map((item) => [item.field, item.message]))

  useEffect(() => {
    let cancelled = false
    getLifeChapters({ parent_id: 'root', page_size: 100 }).then((result) => !cancelled && setParents(result.data)).catch(() => {})
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    if (!resubmitId) return
    const numericId = Number(resubmitId)
    if (!Number.isInteger(numericId) || numericId <= 0) { setError(new Error('章节申请编号不合法。')); return }
    let cancelled = false
    getMyChapterSubmission(numericId).then((chapter) => {
      if (!cancelled) setForm((current) => ({ ...current, name: chapter.name, chapter_type: chapter.chapter_type, parent_id: chapter.parent?.id ? String(chapter.parent.id) : '', country: chapter.country || '', province: chapter.province || '', city: chapter.city || '', description: chapter.description || '' }))
    }).catch((requestError) => { if (!cancelled) setError(requestError) })
    return () => { cancelled = true }
  }, [resubmitId])
  useEffect(() => { coverPublicIdRef.current = form.cover_public_id }, [form.cover_public_id])
  useEffect(() => () => {
    if (coverPublicIdRef.current) deleteUnboundImage(coverPublicIdRef.current).catch(() => {})
  }, [])
  useEffect(() => {
    if (!form.name.trim()) {
      return undefined
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      checkLifeChapterName({ name: form.name, parent_id: form.parent_id || undefined }).then((result) => {
        if (!cancelled) setCheck(result)
      }).catch(() => {
        if (!cancelled) setCheck(null)
      })
    }, 350)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [form.name, form.parent_id])

  function update(field, value) {
    setError(null)
    if (field === 'name' || field === 'parent_id') setCheck(null)
    setForm((current) => ({ ...current, [field]: value }))
  }
  async function removeCover() {
    if (form.cover_public_id) await deleteUnboundImage(form.cover_public_id)
    setForm((current) => ({ ...current, cover_media_id: null, cover_url: null, cover_public_id: null }))
  }
  async function submit(event) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const payload = {
        name: form.name, chapter_type: form.chapter_type, parent_id: form.parent_id ? Number(form.parent_id) : null,
        country: form.country || null, province: form.province || null, city: form.city || null,
        description: form.description || null,
        ...(!resubmitId ? { cover_media_id: form.cover_media_id } : {}),
      }
      const chapter = resubmitId ? await resubmitLifeChapter(Number(resubmitId), payload) : await createLifeChapter(payload)
      coverPublicIdRef.current = null
      navigate(resubmitId ? '/me/reviewing' : `/life/chapter/${chapter.slug}`)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="life-page page-container">
      <Link className="text-link" to="/life/chapters">返回章节</Link>
      <h1>{resubmitId ? '重新提交生活章节' : '创建生活章节'}</h1>
      <p>{form.parent_id ? `正在创建「${parents.find((item) => String(item.id) === form.parent_id)?.name || '所选章节'}」下的二级章节。` : '当前将创建一个一级章节。'}</p>
      <form className="life-form" onSubmit={submit} noValidate>
        <label>名称<input value={form.name} maxLength="80" aria-invalid={Boolean(fieldErrors.name)} onChange={(event) => update('name', event.target.value)} /></label>
        {form.name.trim() && check?.exact_match && <p className="form-feedback form-feedback--error">已有同层级同名章节：<Link to={`/life/chapter/${check.exact_match.slug}`}>{check.exact_match.name}</Link></p>}
        {form.name.trim() && check?.candidates?.length > 0 && <div className="form-feedback">可能相近的章节：{check.candidates.map((item) => <Link key={item.id} to={`/life/chapter/${item.slug}`}>{item.name}</Link>)}</div>}
        {fieldErrors.name && <p className="form-feedback form-feedback--error">{fieldErrors.name}</p>}
        <label>类型<select value={form.chapter_type} onChange={(event) => update('chapter_type', event.target.value)}>{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>父章节（可选）<select value={form.parent_id} onChange={(event) => update('parent_id', event.target.value)}><option value="">创建一级章节</option>{parents.map((chapter) => <option value={chapter.id} key={chapter.id}>{chapter.name}</option>)}</select></label>
        <div className="life-form__pair"><label>国家<input value={form.country} maxLength="100" onChange={(event) => update('country', event.target.value)} /></label><label>省份<input value={form.province} maxLength="100" onChange={(event) => update('province', event.target.value)} /></label></div>
        <label>城市<input value={form.city} maxLength="100" onChange={(event) => update('city', event.target.value)} /></label>
        <label>简介<textarea value={form.description} maxLength="500" onChange={(event) => update('description', event.target.value)} /></label>
        {!resubmitId && <section className="chapter-cover"><h2>章节封面（可选）</h2><ImageUploadField label="章节封面" variant="cover" purpose="content" currentImageUrl={form.cover_url} onUploaded={async (media) => { if (form.cover_public_id) await deleteUnboundImage(form.cover_public_id).catch(() => {}); setForm((current) => ({ ...current, cover_media_id: media.id, cover_url: media.thumbnail_url, cover_public_id: media.public_id })) }} onRemove={removeCover} disabled={pending} /></section>}
        {error && <p className="form-feedback form-feedback--error" role="alert">{fieldErrors.cover_media_id || error.message}</p>}
        <button className="button button--primary" disabled={pending || (form.name.trim() && Boolean(check?.exact_match))}>{pending ? '正在保存…' : resubmitId ? '重新提交' : '创建章节'}</button>
      </form>
    </section>
  )
}
