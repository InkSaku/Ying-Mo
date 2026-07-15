const NOTIFICATION_TYPES = {
  like: {
    title: '赞了你的内容',
    label: '收到喜欢',
    icon: '心',
    tone: 'like',
  },
  comment: {
    title: '评论了你的内容',
    label: '新评论',
    icon: '评',
    tone: 'comment',
  },
  reply: {
    title: '回复了你',
    label: '新回复',
    icon: '回',
    tone: 'reply',
  },
  chapter_review: {
    title: '生活章节审核有了结果',
    label: '章节审核',
    icon: '审',
    tone: 'review',
  },
  content_hidden: {
    title: '你的内容状态发生了变化',
    label: '内容状态',
    icon: '状',
    tone: 'moderation',
  },
  report_result: {
    title: '你提交的举报已有处理结果',
    label: '处理结果',
    icon: '结',
    tone: 'result',
  },
  system: {
    title: '映墨发来一条系统通知',
    label: '系统通知',
    icon: '墨',
    tone: 'system',
  },
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function targetLabel(payload) {
  const title = text(payload.title)
  return title ? `「${title}」` : ''
}

export function formatNotification(item) {
  const payload = item?.payload && typeof item.payload === 'object' ? item.payload : {}
  const type = item?.type || item?.notification_type || 'system'
  const config = NOTIFICATION_TYPES[type] || NOTIFICATION_TYPES.system
  const explicitMessage = text(payload.message)
  const excerpt = text(payload.comment_excerpt)
  const target = targetLabel(payload)

  let body = explicitMessage
  if (!body && type === 'like') body = target ? `有人喜欢了你的内容 ${target}` : '有人喜欢了你发布的内容。'
  if (!body && type === 'comment') body = excerpt || (target ? `有人在 ${target} 下留下了评论。` : '有人在你的内容下留下了评论。')
  if (!body && type === 'reply') body = excerpt || '有人回复了你留下的评论。'
  if (!body && !['like', 'comment', 'reply'].includes(type)) body = target || text(payload.title)
  if (!body) body = '打开通知中心查看这条消息的详细内容。'

  return {
    ...config,
    body,
    targetUrl: text(payload.target_url),
  }
}

export function notificationActorName(item) {
  if (item?.actor?.nickname) return item.actor.nickname
  if (item?.actor?.username) return item.actor.username
  return (item?.type || item?.notification_type) === 'system' ? '映墨' : '一位用户'
}

export function formatNotificationTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '时间未知'

  const elapsed = Date.now() - date.getTime()
  if (elapsed >= 0 && elapsed < 60_000) return '刚刚'
  if (elapsed >= 0 && elapsed < 3_600_000) return `${Math.max(1, Math.floor(elapsed / 60_000))} 分钟前`
  if (elapsed >= 0 && elapsed < 86_400_000) return `${Math.max(1, Math.floor(elapsed / 3_600_000))} 小时前`

  const now = new Date()
  const sameYear = now.getFullYear() === date.getFullYear()
  return date.toLocaleDateString('zh-CN', sameYear
    ? { month: 'long', day: 'numeric' }
    : { year: 'numeric', month: 'long', day: 'numeric' })
}

export function notificationDateLabel(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '更早'

  const startToday = new Date()
  startToday.setHours(0, 0, 0, 0)
  const startDate = new Date(date)
  startDate.setHours(0, 0, 0, 0)
  const days = Math.round((startToday.getTime() - startDate.getTime()) / 86_400_000)

  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  return date.toLocaleDateString('zh-CN', startToday.getFullYear() === date.getFullYear()
    ? { month: 'long', day: 'numeric' }
    : { year: 'numeric', month: 'long', day: 'numeric' })
}
