import { useEffect, useId, useRef, useState } from 'react'

const INITIAL_VALUES = { reason: '', resolution_message: '', internal_note: '', confirm_text: '', target_chapter_id: '', name: '', aliases: '', role: '', note: '' }

export default function AdminActionDialog(props) {
  if (!props.open) return null
  const fieldKey = props.fields.map((field) => `${field.name}:${field.value ?? ''}`).join('|')
  return <ActionForm key={fieldKey} {...props} />
}

function ActionForm({ title, eyebrow = '治理操作', description, context, fields = [], dangerous = false, submitLabel = '确认操作', onClose, onSubmit }) {
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
      <header className="admin-action-dialog__header">
        <span className="admin-action-dialog__mark" aria-hidden="true">{dangerous ? '!' : '映'}</span>
        <div>
          <p>{dangerous ? '高风险操作' : eyebrow}</p>
          <h2 id={headingId}>{title}</h2>
        </div>
        <button type="button" className="admin-action-dialog__close" aria-label="关闭" disabled={submitting} onClick={onClose}>×</button>
      </header>
      {description && <p className="admin-action-dialog__description">{description}</p>}
      {context && <section className="admin-action-dialog__context" aria-label="治理对象">
        <span>{context.eyebrow || '治理对象'}</span>
        <strong>{context.title}</strong>
        {context.meta && <small>{context.meta}</small>}
      </section>}
      {dangerous && <div className="admin-action-dialog__warning" role="note">
        <strong>操作不可撤销</strong>
        <span>永久删除会移除内容及其关联数据，请确认对象和原因无误。</span>
      </div>}
      <div className="admin-action-dialog__fields">
        {fields.map((field, index) => {
          const inputId = `${headingId}-${field.name}`
          const hintId = field.hint ? `${inputId}-hint` : undefined
          const shared = { id: inputId, 'aria-describedby': hintId, ref: index === 0 ? firstInputRef : undefined, value: values[field.name] ?? '', required: field.required, disabled: submitting, onChange: (event) => setValues((current) => ({ ...current, [field.name]: event.target.value })) }
          return <div className="admin-action-dialog__field" key={field.name}>
            <label htmlFor={inputId}><span>{field.label}</span>{field.required && <em aria-hidden="true">必填</em>}</label>
            {field.type === 'select'
              ? <select {...shared}>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              : field.type === 'textarea'
                ? <textarea {...shared} placeholder={field.placeholder} />
                : <input {...shared} type={field.type || 'text'} placeholder={field.placeholder} />}
            {field.hint && <small id={hintId}>{field.hint}</small>}
          </div>
        })}
      </div>
      {error && <p className="form-feedback form-feedback--error" role="alert">{error}</p>}
      <footer className="admin-action-dialog__footer"><small>{dangerous ? '确认后将记录到操作日志' : '提交后将同步更新内容状态'}</small><div><button type="button" className="button button--quiet" disabled={submitting} onClick={onClose}>取消</button><button className={dangerous ? 'button button--danger' : 'button button--primary'} disabled={submitting}>{submitting ? '处理中…' : submitLabel}</button></div></footer>
    </form>
  </div>
}
