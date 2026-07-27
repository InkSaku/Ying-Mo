export function plainTextSummary(value = '', maximum = 160) {
  const text = String(value)
    .replace(/\{\{yingmo-media:[^}]+\}\}/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+/gm, '')
    .replace(/[*_~`|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, maximum)
}

export function hasLifeContent({ body, mediaIds, externalVideoUrl }) {
  return Boolean(body?.trim() || mediaIds?.length || externalVideoUrl?.trim())
}

export function lifePostDisplayTitle(post) {
  return post.title?.trim() || plainTextSummary(post.excerpt || post.body, 52)
}

export function isLongLifePost(post) {
  return post.content_format === 'markdown' && (post.excerpt?.length >= 120 || post.body?.length >= 360)
}
