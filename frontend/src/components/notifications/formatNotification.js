const TITLES = {
  like: '赞了你的内容',
  comment: '评论了你的内容',
  reply: '回复了你',
  chapter_review: '章节审核通知',
  content_hidden: '内容状态通知',
  report_result: '举报处理结果',
  system: '系统通知',
}

export function formatNotification(item) {
  const payload = item?.payload && typeof item.payload === 'object' ? item.payload : {}
  const type = item?.type || item?.notification_type
  return {
    title: TITLES[type] || '系统通知',
    body: String(payload.message || payload.title || payload.comment_excerpt || '你有一条新通知。'),
  }
}
