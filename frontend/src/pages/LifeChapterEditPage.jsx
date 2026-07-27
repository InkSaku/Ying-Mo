import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as adminApi from '../api/admin.js'
import { getManagedLifeChapter, updateLifeChapter } from '../api/life.js'
import ChapterDeleteDialog from '../components/life/ChapterDeleteDialog.jsx'
import ChapterEditorForm from '../components/life/ChapterEditorForm.jsx'
import { useAuth } from '../auth/useAuth.js'

export default function LifeChapterEditPage({ admin = false }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [state, setState] = useState({ loading: true, chapter: null, error: null })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [force, setForce] = useState({ reason: '', confirmation: '', pending: false, error: null })
  const [forcePreview, setForcePreview] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = admin ? adminApi.getAdminChapter : getManagedLifeChapter
    load(id).then((chapter) => {
      if (!cancelled) setState({ loading: false, chapter, error: null })
    }).catch((error) => {
      if (!cancelled) setState({ loading: false, chapter: null, error })
    })
    return () => { cancelled = true }
  }, [admin, id])

  useEffect(() => {
    if (!admin || user?.role !== 'system_admin') return undefined
    let cancelled = false
    adminApi.getAdminChapterDeletionPreview(id)
      .then((preview) => { if (!cancelled) setForcePreview(preview) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [admin, id, user?.role])

  if (state.loading) return <section className={admin ? 'admin-page' : 'life-page page-container'}><p>正在加载合集…</p></section>
  if (state.error) return <section className={admin ? 'admin-page' : 'life-page page-container'}><p className="form-feedback form-feedback--error">{state.error.message}</p></section>
  const chapter = state.chapter
  const back = admin ? '/admin/chapters' : '/me/chapters'

  async function save(payload) {
    setSaving(true)
    setSaveError(null)
    try {
      const update = admin ? adminApi.updateAdminChapter : updateLifeChapter
      const saved = await update(chapter.id, payload)
      setState({ loading: false, chapter: saved, error: null })
    } catch (error) {
      setSaveError(error)
      throw error
    } finally {
      setSaving(false)
    }
  }

  async function forceDelete(event) {
    event.preventDefault()
    setForce((current) => ({ ...current, pending: true, error: null }))
    try {
      await adminApi.forceDeleteAdminChapter(chapter.id, {
        reason: force.reason,
        confirmation: force.confirmation,
        cascade_posts: true,
        cascade_children: true,
      })
      navigate('/admin/chapters', { replace: true })
    } catch (error) {
      setForce((current) => ({ ...current, pending: false, error }))
    }
  }

  return (
    <section className={admin ? 'admin-page chapter-editor-page' : 'life-page page-container chapter-editor-page'}>
      <Link className="text-link" to={back}>返回{admin ? '合集管理' : '我的合集'}</Link>
      <p className="eyebrow">{admin ? '后台合集编辑' : '合集管理'}</p>
      <h1>编辑「{chapter.name}」</h1>
      {chapter.status === 'merged' ? <div className="state-message"><p>这个合集已经合并，不能继续编辑。</p>{chapter.merged_into && <Link to={`/life/chapter/${chapter.merged_into.slug}`}>查看合并目标「{chapter.merged_into.name}」</Link>}</div> : <>
        <ChapterEditorForm key={`${chapter.id}:${chapter.updated_at}`} initial={chapter} admin={admin} pending={saving} requestError={saveError} onSubmit={save} />
        <section className="chapter-danger-zone">
          <h2>删除合集</h2>
          <p>系统会先检查内容、子合集和封面。有关联内容时必须迁移，不会直接误删其他用户内容。</p>
          <button className="button button--danger" type="button" onClick={() => setDeleting(true)}>删除合集</button>
        </section>
        {admin && user?.role === 'system_admin' && <form className="chapter-danger-zone chapter-danger-zone--force" onSubmit={forceDelete}>
          <h2>强制永久删除</h2>
          <p>危险操作：会永久删除章节、子章节、相关日常、互动、举报和图片。仅用于无法通过安全迁移处理的治理场景。</p>
          {forcePreview && <p>当前将永久删除 {forcePreview.force_delete_post_count} 条日常、{forcePreview.force_delete_child_count} 个子章节和 {forcePreview.force_delete_image_count} 张图片。</p>}
          <label>详细原因<textarea required maxLength="1000" value={force.reason} onChange={(event) => setForce((current) => ({ ...current, reason: event.target.value }))} /></label>
          <label>输入 DELETE CHAPTER {chapter.id}<input required value={force.confirmation} onChange={(event) => setForce((current) => ({ ...current, confirmation: event.target.value }))} /></label>
          {force.error && <p className="form-feedback form-feedback--error">{force.error.message}</p>}
          <button className="button button--danger" disabled={force.pending}>{force.pending ? '正在永久删除…' : '强制永久删除'}</button>
        </form>}
      </>}
      <ChapterDeleteDialog chapter={chapter} admin={admin} open={deleting} onClose={() => setDeleting(false)} onDeleted={(result) => navigate(result.mode === 'merged' ? `/life/chapter/${result.canonical_slug}` : back, { replace: true })} />
    </section>
  )
}
