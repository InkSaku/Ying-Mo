import { useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteUnboundImage } from '../api/uploads.js'
import { removeCurrentUserAvatar, setCurrentUserAvatar, updateCurrentUser } from '../api/users.js'
import ImageUploadField from '../components/upload/ImageUploadField.jsx'
import { useAuth } from '../auth/useAuth.js'

function formFromUser(user) {
  return { nickname: user?.nickname || '', bio: user?.bio || '', region: user?.region || '' }
}

export default function ProfileSettingsPage() {
  const { user, updateAuthenticatedUser } = useAuth()
  const [form, setForm] = useState(() => formFromUser(user))
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState(null)

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function save(event) {
    event.preventDefault()
    if (pending) return
    setFeedback(null)
    const nickname = form.nickname.trim()
    if (!nickname || nickname.length > 30 || form.bio.length > 500 || form.region.length > 100) {
      setFeedback({ type: 'error', message: '请检查昵称、简介和地区的长度。' })
      return
    }
    setPending(true)
    try {
      const nextUser = await updateCurrentUser({ nickname, bio: form.bio || null, region: form.region || null })
      updateAuthenticatedUser(nextUser)
      setFeedback({ type: 'success', message: '资料已保存。' })
    } catch (requestError) {
      setFeedback({ type: 'error', message: requestError.details?.[0]?.message || requestError.message })
    } finally {
      setPending(false)
    }
  }

  async function handleUploaded(media) {
    try {
      const nextUser = await setCurrentUserAvatar(media.id)
      updateAuthenticatedUser(nextUser)
      setFeedback({ type: 'success', message: '头像已更新。' })
    } catch (requestError) {
      try { await deleteUnboundImage(media.public_id) } catch { /* 后端会保留未绑定文件供用户稍后清理。 */ }
      throw requestError
    }
  }

  async function handleRemoveAvatar() {
    await removeCurrentUserAvatar()
    updateAuthenticatedUser({ ...user, avatar_url: null })
    setFeedback({ type: 'success', message: '头像已删除。' })
  }

  return (
    <section className="profile-page page-container">
      <header className="profile-page__heading">
        <p className="eyebrow">个人设置</p>
        <h1>把自己的这一页慢慢整理好</h1>
        <p>这些信息会显示在你的公开主页上。</p>
      </header>
      <div className="profile-settings-grid">
        <aside className="profile-avatar-card">
          <h2>头像</h2>
          <ImageUploadField purpose="avatar" currentImageUrl={user.avatar_url} onUploaded={handleUploaded} onRemove={handleRemoveAvatar} disabled={pending} />
        </aside>
        <form className="profile-form" onSubmit={save} noValidate>
          <div className="profile-form__readonly">
            <label>用户名<input value={user.username} readOnly /></label>
            <label>邮箱<input value={user.email} readOnly /></label>
          </div>
          <label>昵称<input value={form.nickname} minLength="1" maxLength="30" required onChange={(event) => updateField('nickname', event.target.value)} /><small>{form.nickname.trim().length}/30</small></label>
          <label>简介<textarea value={form.bio} maxLength="500" rows="5" onChange={(event) => updateField('bio', event.target.value)} /><small>{form.bio.length}/500</small></label>
          <label>地区<input value={form.region} maxLength="100" onChange={(event) => updateField('region', event.target.value)} /><small>{form.region.length}/100</small></label>
          {feedback && <p className={`form-feedback form-feedback--${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.message}</p>}
          <div className="profile-form__actions"><button className="button button--primary" disabled={pending}>{pending ? '正在保存…' : '保存资料'}</button><Link className="button" to={`/user/${encodeURIComponent(user.username)}`}>查看公开主页</Link></div>
        </form>
      </div>
    </section>
  )
}
