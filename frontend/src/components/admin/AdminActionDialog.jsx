import { useEffect, useId, useRef, useState } from 'react'

const INITIAL_VALUES = { reason: '', resolution_message: '', internal_note: '', confirm_text: '', target_chapter_id: '', name: '', aliases: '', role: '' }

export default function AdminActionDialog(props) {
  if (!props.open) return null
  const fieldKey = props.fields.map((field) => `${field.name}:${field.value ?? ''}`).join('|')
  return <ActionForm key={fieldKey} {...props} />
}

function ActionForm({ title, description, fields = [], dangerous = false, submitLabel = '确认操作', onClose, onSubmit }) {
  const headingId = useId()
  const firstInputRef = useRef(null)
  const [values, setValues] = useState(() => ({ ...INITIAL_VALUES, ...Object.fromEntries(fields.map((field) => [field.name, field.value ?? ''])) }))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const focusTimer = window.setTimeout(() => firstInputRef.current?.focus(), 0)
    const onKeyDown = (event) => { if (event.key === 'Escape' && !submitting) onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.clearTimeout(focusTimer); window.removeEventListener('keydown', onKeyDown) }
  }, [onClose, submitting])

  async function submit(event) {
    event.preventDefault()
    const missing = fields.find((field) => field.required && !String(values[field.name] || '').trim())
    if (missing) { setError(`请填写${missing.label}。`); return }
    setSubmitting(true); setError(null)
    try { await onSubmit(values); onClose() } catch (requestError) { setError(requestError.message || '操作失败，请重试。') } finally { setSubmitting(false) }
  }

  return <div className="admin-action-dialog__backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose() }}>
    <form className={`admin-action-dialog ${dangerous ? 'admin-action-dialog--danger' : ''}`} role="dialog" aria-modal="true" aria-labelledby={headingId} onSubmit={submit}>
      <header><h2 id={headingId}>{title}</h2><button type="button" className="button--quiet" aria-label="关闭" disabled={submitting} onClick={onClose}>关闭</button></header>
      {description && <p>{description}</p>}
      {fields.map((field, index) => <label key={field.name}><span>{field.label}{field.required && '（必填）'}</span>{field.type === 'select' ? <select ref={index === 0 ? firstInputRef : undefined} value={values[field.name] ?? ''} disabled={submitting} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === 'textarea' ? <textarea ref={index === 0 ? firstInputRef : undefined} value={values[field.name] ?? ''} disabled={submitting} placeholder={field.placeholder} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} /> : <input ref={index === 0 ? firstInputRef : undefined} type={field.type || 'text'} value={values[field.name] ?? ''} disabled={submitting} placeholder={field.placeholder} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} />}</label>)}
      {error && <p className="form-feedback form-feedback--error" role="alert">{error}</p>}
      <footer><button type="button" className="button--quiet" disabled={submitting} onClick={onClose}>取消</button><button className={dangerous ? 'button--danger' : 'button button--primary'} disabled={submitting}>{submitting ? '提交中…' : submitLabel}</button></footer>
    </form>
  </div>
}
