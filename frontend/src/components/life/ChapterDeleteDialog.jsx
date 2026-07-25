import { useEffect, useState } from 'react'
import * as adminApi from '../../api/admin.js'
import { deleteLifeChapter, getLifeChapterDeletionPreview } from '../../api/life.js'

export default function ChapterDeleteDialog({ chapter, open, admin = false, onClose, onDeleted }) {
  const [state, setState] = useState({ loading: true, preview: null, error: null })
  const [form, setForm] = useState({ confirmation_name: '', target_chapter_id: '', reason: '' })
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    setState({ loading: true, preview: null, error: null })
    const load = admin ? adminApi.getAdminChapterDeletionPreview : getLifeChapterDeletionPreview
    load(chapter.id).then((preview) => {
      if (!cancelled) setState({ loading: false, preview, error: null })
    }).catch((error) => {
      if (!cancelled) setState({ loading: false, preview: null, error })
    })
    return () => { cancelled = true }
  }, [admin, chapter.id, open])

  if (!open) return null
  const preview = state.preview
  const reasonRequired = admin && !chapter.is_owner

  async function submit(event) {
    event.preventDefault()
    if (pending || !preview) return
    setPending(true)
    setState((current) => ({ ...current, error: null }))
    const payload = {
      confirmation_name: form.confirmation_name,
      ...(preview.requires_target ? { target_chapter_id: Number(form.target_chapter_id) } : {}),
      ...(form.reason.trim() ? { reason: form.reason.trim() } : {}),
    }
    try {
      const remove = admin ? adminApi.deleteAdminChapter : deleteLifeChapter
      const result = await remove(chapter.id, payload)
      onDeleted(result)
    } catch (error) {
      setState((current) => ({ ...current, error }))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="chapter-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="chapter-delete-title">
      <form className="chapter-delete-dialog__panel" onSubmit={submit}>
        <h2 id="chapter-delete-title">删除章节「{chapter.name}」</h2>
        {state.loading && <p>正在检查关联内容…</p>}
        {preview && <>
          <dl className="life-facts">
            <div><dt>日常</dt><dd>{preview.post_count} 条</dd></div>
            <div><dt>其他作者日常</dt><dd>{preview.other_author_post_count} 条</dd></div>
            <div><dt>子章节</dt><dd>{preview.child_count} 个</dd></div>
            <div><dt>封面</dt><dd>{preview.has_cover ? '将清理' : '无'}</dd></div>
          </dl>
          {preview.child_name_conflicts?.length > 0 && <div className="form-feedback form-feedback--error">子章节提升存在同名冲突：{preview.child_name_conflicts.map((item) => item.chapter_name).join('、')}</div>}
          {preview.requires_target && <label>迁移到
            <select required value={form.target_chapter_id} onChange={(event) => setForm((current) => ({ ...current, target_chapter_id: event.target.value }))}>
              <option value="">选择目标章节</option>
              {preview.eligible_targets.map((item) => <option key={item.id} value={item.id}>{item.name}（{item.contribution_policy === 'private' ? '私有' : '公有'}）</option>)}
            </select>
          </label>}
          <label>输入完整章节名称确认<input required value={form.confirmation_name} placeholder={chapter.name} onChange={(event) => setForm((current) => ({ ...current, confirmation_name: event.target.value }))} /></label>
          {admin && <label>管理原因{reasonRequired ? '' : '（可选）'}<textarea required={reasonRequired} maxLength="1000" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} /></label>}
          <p className="chapter-delete-dialog__note">{preview.requires_target ? '日常会迁移，原章节会保留为跳转记录；不会删除其他用户的日常。' : preview.child_count ? '子章节会提升为一级章节，源章节永久删除。' : '空章节将永久删除。'}</p>
        </>}
        {state.error && <p className="form-feedback form-feedback--error" role="alert">{state.error.message}</p>}
        <div className="life-form__actions"><button type="button" disabled={pending} onClick={onClose}>取消</button><button className="button button--danger" disabled={pending || state.loading || Boolean(preview?.child_name_conflicts?.length)}>{pending ? '正在处理…' : '确认删除'}</button></div>
      </form>
    </div>
  )
}
