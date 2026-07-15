import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getNotifications, getUnreadNotificationCount } from '../../api/notifications.js'
import { formatNotification, notificationActorName } from './formatNotification.js'
import { NOTIFICATION_COUNT_EVENT } from './notificationCount.js'

const POLL_INTERVAL = 20_000
const NOTICE_DURATION = 6_000

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  )
}

export default function NotificationBell() {
  const [count, setCount] = useState(0)
  const [notice, setNotice] = useState(null)
  const [ringing, setRinging] = useState(false)
  const countRef = useRef(0)
  const initializedRef = useRef(false)
  const runningRef = useRef(false)
  const noticeTimerRef = useRef(null)
  const ringTimerRef = useRef(null)

  useEffect(() => {
    let active = true

    function clearNoticeTimer() {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
      noticeTimerRef.current = null
    }

    function clearRingTimer() {
      if (ringTimerRef.current) window.clearTimeout(ringTimerRef.current)
      ringTimerRef.current = null
    }

    function applyCount(nextCount) {
      const normalized = Math.max(0, Number(nextCount) || 0)
      countRef.current = normalized
      if (active) setCount(normalized)
      return normalized
    }

    async function announce(delta) {
      let latest = null
      try {
        const result = await getNotifications({ status: 'unread', page: 1, page_size: 1 })
        latest = result.data?.[0] || null
      } catch {
        // The unread count remains useful even if the preview request fails.
      }
      if (!active) return

      const formatted = latest ? formatNotification(latest) : null
      setNotice({
        id: latest?.id || Date.now(),
        title: delta > 1 ? `你有 ${delta} 条新通知` : '你有一条新通知',
        body: latest
          ? `${notificationActorName(latest)} · ${formatted.title}`
          : '打开通知中心查看新消息。',
      })
      setRinging(true)

      clearNoticeTimer()
      clearRingTimer()
      noticeTimerRef.current = window.setTimeout(() => active && setNotice(null), NOTICE_DURATION)
      ringTimerRef.current = window.setTimeout(() => active && setRinging(false), 1_200)
    }

    async function refresh({ announceChanges = true } = {}) {
      if (runningRef.current || document.visibilityState === 'hidden') return
      runningRef.current = true
      try {
        const value = Math.max(0, Number(await getUnreadNotificationCount()) || 0)
        const previous = countRef.current
        applyCount(value)
        if (initializedRef.current && announceChanges && value > previous) {
          await announce(value - previous)
        }
        initializedRef.current = true
      } catch {
        // Notification polling should never interrupt the rest of the header.
      } finally {
        runningRef.current = false
      }
    }

    function sync(event) {
      const detail = event.detail
      if (detail?.type === 'refresh') {
        void refresh({ announceChanges: false })
        return
      }
      if (detail?.type === 'decrease') {
        applyCount(countRef.current - Math.max(1, Number(detail.amount) || 1))
        return
      }
      if (detail?.type === 'set') {
        applyCount(detail.count)
        return
      }

      // Keep compatibility with events dispatched by earlier frontend builds.
      if (detail === 'decrease') applyCount(countRef.current - 1)
      else applyCount(detail)
    }

    const visible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const focused = () => void refresh()
    const online = () => void refresh({ announceChanges: false })

    void refresh({ announceChanges: false })
    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL)
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('focus', focused)
    window.addEventListener('online', online)
    window.addEventListener(NOTIFICATION_COUNT_EVENT, sync)

    return () => {
      active = false
      window.clearInterval(timer)
      clearNoticeTimer()
      clearRingTimer()
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('focus', focused)
      window.removeEventListener('online', online)
      window.removeEventListener(NOTIFICATION_COUNT_EVENT, sync)
    }
  }, [])

  return (
    <div className="notification-entry">
      <Link
        className={`notification-bell ${ringing ? 'is-ringing' : ''} ${count > 0 ? 'has-unread' : ''}`}
        to="/notifications"
        aria-label={count ? `${count} 条未读通知` : '通知中心，没有未读消息'}
      >
        <BellIcon />
        {count > 0 && <span className="notification-bell__count">{count > 99 ? '99+' : count}</span>}
      </Link>

      {notice && (
        <aside className="notification-arrival" role="status" aria-live="polite">
          <span className="notification-arrival__mark" aria-hidden="true"><BellIcon /></span>
          <Link to="/notifications">
            <strong>{notice.title}</strong>
            <span>{notice.body}</span>
          </Link>
          <button type="button" aria-label="关闭新通知提示" onClick={() => setNotice(null)}>×</button>
        </aside>
      )}
    </div>
  )
}
