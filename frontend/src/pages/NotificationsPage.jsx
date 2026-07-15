import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications.js'
import {
  formatNotification,
  formatNotificationTime,
  notificationActorName,
  notificationDateLabel,
} from '../components/notifications/formatNotification.js'
import {
  decreaseNotificationCount,
  setNotificationCount,
} from '../components/notifications/notificationCount.js'
import Pagination from '../components/life/Pagination.jsx'

const PAGE_SIZE = 20

function safeTarget(url) {
  return typeof url === 'string'
    && url.startsWith('/')
    && !url.startsWith('//')
    && !url.includes('://')
}

function positivePage(value) {
  const page = Number(value || 1)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function groupNotifications(items) {
  const groups = []
  items.forEach((item) => {
    const label = notificationDateLabel(item.created_at)
    const last = groups.at(-1)
    if (last?.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  })
  return groups
}

function NotificationAvatar({ item }) {
  const actorName = notificationActorName(item)
  if (item.actor?.avatar_url) {
    return <img className="notification-card__avatar" src={item.actor.avatar_url} alt="" />
  }
  return <span className="notification-card__avatar" aria-hidden="true">{actorName.slice(0, 1)}</span>
}

function NotificationCard({ item, busy, onOpen, onRead }) {
  const content = formatNotification(item)
  const actorName = notificationActorName(item)
  const hasTarget = safeTarget(content.targetUrl)
  const canOpen = hasTarget || !item.is_read
  const cardBody = (
    <>
      <NotificationAvatar item={item} />
      <span className={`notification-card__type notification-card__type--${content.tone}`} aria-hidden="true">{content.icon}</span>
      <span className="notification-card__copy">
        <span className="notification-card__topline">
          <span>{content.label}</span>
          <time dateTime={item.created_at} title={new Date(item.created_at).toLocaleString('zh-CN')}>
            {formatNotificationTime(item.created_at)}
          </time>
        </span>
        <strong><b>{actorName}</b>{content.title}</strong>
        <span className="notification-card__body">{content.body}</span>
      </span>
      {!item.is_read && <span className="notification-card__unread" aria-label="未读" />}
    </>
  )

  return (
    <article className={`notification-card ${item.is_read ? '' : 'is-unread'}`}>
      {canOpen ? (
        <button type="button" className="notification-card__main" disabled={busy} onClick={() => onOpen(item)}>
          {cardBody}
        </button>
      ) : (
        <div className="notification-card__main">{cardBody}</div>
      )}
      <div className="notification-card__actions">
        {hasTarget && <button type="button" disabled={busy} onClick={() => onOpen(item)}>查看内容 <span aria-hidden="true">→</span></button>}
        {!item.is_read && <button type="button" disabled={busy} onClick={() => onRead(item)}>{busy ? '处理中…' : '标为已读'}</button>}
      </div>
    </article>
  )
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') === 'unread' ? 'unread' : 'all'
  const page = positivePage(searchParams.get('page'))
  const requestKey = `${status}:${page}`
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState({ key: null, items: [], pagination: null, error: '' })
  const [unreadCount, setUnreadCount] = useState(0)
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getNotifications({ status, page, page_size: PAGE_SIZE }),
      getUnreadNotificationCount(),
    ]).then(([result, count]) => {
      if (cancelled) return
      setState({ key: requestKey, items: result.data, pagination: result.meta.pagination, error: '' })
      setUnreadCount(count)
      setNotificationCount(count)
    }).catch((error) => {
      if (!cancelled) setState({ key: requestKey, items: [], pagination: null, error: error.message || '通知暂时无法加载。' })
    })
    return () => { cancelled = true }
  }, [requestKey, status, page, reloadKey])

  const loading = state.key !== requestKey
  const items = loading ? [] : state.items
  const pagination = loading ? null : state.pagination
  const groups = groupNotifications(items)

  function updateSearch(nextStatus, nextPage = 1) {
    const next = new URLSearchParams()
    if (nextStatus === 'unread') next.set('status', 'unread')
    if (nextPage > 1) next.set('page', String(nextPage))
    setSearchParams(next)
  }

  function updateUnreadCount(next) {
    const normalized = Math.max(0, next)
    setUnreadCount(normalized)
    setNotificationCount(normalized)
  }

  function markItemLocally(itemId) {
    setState((current) => ({
      ...current,
      items: current.items.map((item) => item.id === itemId ? { ...item, is_read: true } : item),
    }))
  }

  async function readItem(item, { navigateAfter = false } = {}) {
    const content = formatNotification(item)
    const targetUrl = safeTarget(content.targetUrl) ? content.targetUrl : null
    setActionError('')
    setBusyId(item.id)

    try {
      if (!item.is_read) {
        await markNotificationRead(item.id)
        decreaseNotificationCount()
        setUnreadCount((current) => Math.max(0, current - 1))
        markItemLocally(item.id)
      }

      if (navigateAfter && targetUrl) {
        navigate(targetUrl)
        return
      }

      if (status === 'unread' && !item.is_read) {
        const remaining = items.length - 1
        if (remaining === 0 && pagination?.has_previous) updateSearch(status, page - 1)
        else setReloadKey((value) => value + 1)
      }
    } catch (error) {
      setActionError(error.message || '暂时无法更新通知状态，请稍后重试。')
      if (navigateAfter && targetUrl) navigate(targetUrl)
    } finally {
      setBusyId(null)
    }
  }

  async function markAllRead() {
    if (!unreadCount || markingAll) return
    setMarkingAll(true)
    setActionError('')
    try {
      await markAllNotificationsRead()
      updateUnreadCount(0)
      if (status === 'unread') {
        setState((current) => ({
          ...current,
          items: [],
          pagination: current.pagination ? { ...current.pagination, total: 0, total_pages: 0, has_next: false, has_previous: false } : null,
        }))
      } else {
        setState((current) => ({ ...current, items: current.items.map((item) => ({ ...item, is_read: true })) }))
      }
    } catch (error) {
      setActionError(error.message || '暂时无法将通知全部标为已读。')
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <section className="notifications-page page-container">
      <header className="notifications-hero">
        <div>
          <p className="eyebrow">消息中心</p>
          <h1>通知</h1>
          <p>点赞、评论、审核和系统反馈都会按时间整理在这里。</p>
        </div>
        <div className="notifications-summary" aria-label={`${unreadCount} 条未读通知`}>
          <strong>{unreadCount > 99 ? '99+' : unreadCount}</strong>
          <span>条未读消息</span>
          <small>{unreadCount ? '有新的互动等待查看' : '当前消息都已读'}</small>
        </div>
      </header>

      <div className="notifications-toolbar">
        <div className="notifications-tabs" aria-label="通知范围">
          <button type="button" aria-pressed={status === 'all'} onClick={() => updateSearch('all')}>全部通知</button>
          <button type="button" aria-pressed={status === 'unread'} onClick={() => updateSearch('unread')}>
            未读
            {unreadCount > 0 && <span>{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>
        </div>
        <div className="notifications-toolbar__actions">
          <button type="button" onClick={() => setReloadKey((value) => value + 1)} disabled={loading}>刷新</button>
          <button type="button" className="button button--primary" onClick={() => void markAllRead()} disabled={!unreadCount || markingAll}>
            {markingAll ? '处理中…' : '全部标为已读'}
          </button>
        </div>
      </div>

      {actionError && <div className="notifications-feedback" role="alert"><span>{actionError}</span><button type="button" onClick={() => setActionError('')}>关闭</button></div>}

      {loading && (
        <div className="notifications-loading" aria-label="正在加载通知">
          {[0, 1, 2].map((item) => <span key={item} />)}
        </div>
      )}

      {!loading && state.error && (
        <div className="notifications-empty notifications-empty--error" role="alert">
          <span aria-hidden="true">!</span>
          <h2>通知暂时没有加载出来</h2>
          <p>{state.error}</p>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)}>重新加载</button>
        </div>
      )}

      {!loading && !state.error && items.length === 0 && (
        <div className="notifications-empty">
          <span aria-hidden="true">{status === 'unread' ? '✓' : '铃'}</span>
          <h2>{status === 'unread' ? '没有未读通知' : '这里还没有通知'}</h2>
          <p>{status === 'unread' ? '你已经看完了所有新消息，可以去社区继续逛逛。' : '当有人与你互动或系统有新反馈时，消息会出现在这里。'}</p>
          {status === 'unread' && <button type="button" onClick={() => updateSearch('all')}>查看全部通知</button>}
        </div>
      )}

      {!loading && !state.error && groups.length > 0 && (
        <div className="notification-groups">
          {groups.map((group) => (
            <section className="notification-group" key={group.label} aria-labelledby={`notification-group-${group.label}`}>
              <header>
                <h2 id={`notification-group-${group.label}`}>{group.label}</h2>
                <span>{group.items.length} 条</span>
              </header>
              <div className="notification-list">
                {group.items.map((item) => (
                  <NotificationCard
                    key={item.id}
                    item={item}
                    busy={busyId === item.id}
                    onOpen={(value) => void readItem(value, { navigateAfter: true })}
                    onRead={(value) => void readItem(value)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="notifications-pagination">
        <Pagination pagination={pagination} onPageChange={(nextPage) => updateSearch(status, nextPage)} />
      </div>
    </section>
  )
}
