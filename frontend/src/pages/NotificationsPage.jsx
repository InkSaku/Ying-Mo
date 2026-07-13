import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notifications.js'
import { decreaseNotificationCount, setNotificationCount } from '../components/notifications/notificationCount.js'
import { formatNotification } from '../components/notifications/formatNotification.js'

const safe = (url) => typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && !url.includes('://')

export default function NotificationsPage() {
  const nav = useNavigate()
  const [status, setStatus] = useState('all')
  const [state, setState] = useState({ loading: true, items: [], error: '' })
  const load = useCallback(() => {
    setState((current) => ({ ...current, loading: true }))
    getNotifications({ status }).then((result) => setState({ loading: false, items: result.data, error: '' })).catch((error) => setState({ loading: false, items: [], error: error.message }))
  }, [status])
  useEffect(() => { load() }, [load])

  async function open(item) {
    if (!item.is_read) {
      try {
        await markNotificationRead(item.id)
        decreaseNotificationCount()
        setState((current) => ({ ...current, items: current.items.map((value) => value.id === item.id ? { ...value, is_read: true } : value) }))
      } catch { /* Navigation remains available when marking read fails. */ }
    }
    if (safe(item.payload?.target_url)) nav(item.payload.target_url)
  }

  async function allRead() {
    try {
      await markAllNotificationsRead()
      setNotificationCount(0)
      setState((current) => ({ ...current, items: current.items.map((item) => ({ ...item, is_read: true })) }))
    } catch (error) { setState((current) => ({ ...current, error: error.message })) }
  }

  return <section className="account-page page-container"><p className="eyebrow">消息</p><h1>通知</h1><div className="account-tabs"><button onClick={() => setStatus('all')}>全部</button><button onClick={() => setStatus('unread')}>未读</button><button onClick={() => void allRead()}>全部已读</button></div>{state.loading ? <p>正在加载…</p> : state.error ? <p>{state.error} <button onClick={load}>重试</button></p> : state.items.length === 0 ? <p>暂时没有通知。</p> : state.items.map((item) => { const text = formatNotification(item); return <button type="button" className={`notification-item ${item.is_read ? '' : 'is-unread'}`} key={item.id} onClick={() => void open(item)}><strong>{item.actor?.nickname || (item.type === 'system' ? '映墨' : '一位用户')}</strong> {text.title}<span>{text.body}</span><time>{new Date(item.created_at).toLocaleString('zh-CN')}</time></button> })}</section>
}
