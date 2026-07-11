import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'

const initialForm = { username: '', email: '', password: '', password_confirmation: '', accept_terms: false }

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)
  async function submit(event) {
    event.preventDefault()
    if (form.password !== form.password_confirmation) return setError('两次输入的密码不一致。')
    setError(null)
    setPending(true)
    try {
      await register(form)
      navigate('/', { replace: true })
    } catch (requestError) {
      const fieldMessage = requestError.details?.[0]?.message
      setError(fieldMessage || requestError.message)
    } finally { setPending(false) }
  }
  return <section className="auth-page page-container"><form className="auth-card" onSubmit={submit} noValidate><p className="eyebrow">Join Yingmo</p><h1>注册映墨</h1><p>从一段昵称开始，把想留下的日常慢慢存起来。</p>{error ? <p className="auth-error" role="alert">{error}</p> : null}<label>用户名<input required minLength="2" maxLength="20" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} autoComplete="username" /></label><label>邮箱<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" /></label><label>密码<input required type="password" minLength="8" maxLength="128" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" /></label><label>确认密码<input required type="password" minLength="8" maxLength="128" value={form.password_confirmation} onChange={(event) => setForm({ ...form, password_confirmation: event.target.value })} autoComplete="new-password" /></label><label className="auth-check"><input type="checkbox" checked={form.accept_terms} onChange={(event) => setForm({ ...form, accept_terms: event.target.checked })} />我已阅读并同意用户协议</label><button className="button button--primary" disabled={pending}>{pending ? '正在创建账号…' : '注册并登录'}</button><p>已有账号？<Link to="/login">去登录</Link></p></form></section>
}
