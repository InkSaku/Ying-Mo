const INLINE_MEDIA_TOKEN_PATTERN = /\{\{yingmo-media:((?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})|(?:temp-[a-z0-9-]+))(?:\|([^}\r\n]{0,160}))?\}\}/gi

function cleanAltText(value = '') {
  return String(value)
    .replace(/[|}\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
}

export function inlineMediaToken(publicId, alt = '') {
  const cleaned = cleanAltText(alt)
  return `{{yingmo-media:${publicId}${cleaned ? `|${cleaned}` : ''}}}`
}

export function splitInlineMediaContent(value = '') {
  const body = String(value)
  const parts = []
  let cursor = 0
  let match
  INLINE_MEDIA_TOKEN_PATTERN.lastIndex = 0
  while ((match = INLINE_MEDIA_TOKEN_PATTERN.exec(body)) !== null) {
    if (match.index > cursor) {
      parts.push({ type: 'markdown', value: body.slice(cursor, match.index) })
    }
    parts.push({ type: 'media', publicId: match[1], alt: match[2] || '' })
    cursor = match.index + match[0].length
  }
  if (cursor < body.length) {
    parts.push({ type: 'markdown', value: body.slice(cursor) })
  }
  return parts.length ? parts : [{ type: 'markdown', value: body }]
}

export function inlineMediaPublicIds(value = '') {
  return splitInlineMediaContent(value)
    .filter((part) => part.type === 'media')
    .map((part) => part.publicId)
}

export function removeInlineMediaToken(value = '', publicId) {
  const body = String(value)
  INLINE_MEDIA_TOKEN_PATTERN.lastIndex = 0
  return body
    .replace(INLINE_MEDIA_TOKEN_PATTERN, (token, tokenId) => (
      String(tokenId).toLowerCase() === String(publicId).toLowerCase() ? '' : token
    ))
    .replace(/\n{3,}/g, '\n\n')
}

export function replaceInlineMediaToken(value = '', oldPublicId, nextPublicId) {
  const body = String(value)
  INLINE_MEDIA_TOKEN_PATTERN.lastIndex = 0
  return body.replace(INLINE_MEDIA_TOKEN_PATTERN, (token, tokenId, alt) => (
    String(tokenId).toLowerCase() === String(oldPublicId).toLowerCase()
      ? inlineMediaToken(nextPublicId, alt)
      : token
  ))
}

export function updateInlineMediaAlt(value = '', publicId, alt = '') {
  const body = String(value)
  INLINE_MEDIA_TOKEN_PATTERN.lastIndex = 0
  return body.replace(INLINE_MEDIA_TOKEN_PATTERN, (token, tokenId) => (
    String(tokenId).toLowerCase() === String(publicId).toLowerCase()
      ? inlineMediaToken(tokenId, alt)
      : token
  ))
}
