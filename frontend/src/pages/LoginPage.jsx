import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)
  const requested = new URLSearchParams(location.search).get('next')
  const destination = requested && requested.startsWith('/') && !requested.startsWith('//') && !requested.includes('://') ? requested : (location.state?.from?.pathname || '/')

  async function submit(event) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      await login(form)
      navigate(destination, { replace: true })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setPending(false)
    }
  }

  return <section className="auth-page page-container"><form className="auth-card" onSubmit={submit} noValidate><p className="eyebrow">欢迎回来</p><h1>回到映墨</h1><p>那些写了一半的日常，和收藏过的路标，都还在等你。</p>{error ? <p className="auth-error" role="alert">{error}</p> : null}<label>用户名或邮箱<input required value={form.identifier} onChange={(event) => setForm({ ...form, identifier: event.target.value })} autoComplete="username" /></label><label>密码<input required type="password" minLength="8" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="current-password" /></label><button className="button button--primary" disabled={pending}>{pending ? '正在回来…' : '回到映墨'}</button><p>还没有账号？<Link to="/register">在这里写下第一笔</Link></p></form></section>
}
