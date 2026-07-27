import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { splitInlineMediaContent } from '../../utils/lifeMedia.js'
import AdaptiveMedia from '../common/AdaptiveMedia.jsx'
import AuthenticatedMedia from '../common/AuthenticatedMedia.jsx'
import LivePhotoPlayer from './LivePhotoPlayer.jsx'

function InlineMedia({ media, title, description }) {
  if (!media) {
    return <div className="markdown-body__missing-media">这项站内媒体暂时不可用。</div>
  }
  const isLive = media.media_type === 'live_video'
  if (media.preview) {
    return (
      <figure className="markdown-body__media">
        {isLive
          ? <video src={media.preview} controls muted playsInline aria-label={`${title}的本地实况预览`} />
          : <AdaptiveMedia src={media.preview} alt={title} fit="natural" width={media.width} height={media.height} />}
        {isLive && <span className="live-photo-badge">实况</span>}
        {description && <figcaption>{description}</figcaption>}
      </figure>
    )
  }
  return (
    <figure className={`markdown-body__media${isLive ? ' markdown-body__media--live' : ''}`}>
      {isLive
        ? <LivePhotoPlayer media={media} title={title} />
        : <AuthenticatedMedia src={media.url} alt={title} fit="natural" width={media.width} height={media.height} />}
      {description && <figcaption>{description}</figcaption>}
    </figure>
  )
}

function MarkdownFragment({ value }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ children: linkText, href }) => (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {linkText}
          </a>
        ),
        img: ({ src, alt }) => (
          <img src={src} alt={alt || ''} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        ),
      }}
    >
      {value}
    </ReactMarkdown>
  )
}

export default function MarkdownContent({ children, className = '', media = [], title = '正文媒体' }) {
  const mediaLookup = new Map()
  media.forEach((item) => {
    if (item.public_id) mediaLookup.set(String(item.public_id).toLowerCase(), item)
    if (item.id != null) mediaLookup.set(String(item.id).toLowerCase(), item)
  })
  const parts = splitInlineMediaContent(children || '')

  return (
    <div className={['markdown-body', className].filter(Boolean).join(' ')}>
      {parts.map((part, index) => (
        part.type === 'media'
          ? (
            <InlineMedia
              key={`${part.publicId}-${index}`}
              media={mediaLookup.get(part.publicId.toLowerCase())}
              title={part.alt || `${title}，第 ${index + 1} 个正文媒体`}
              description={part.alt}
            />
          )
          : <MarkdownFragment key={`markdown-${index}`} value={part.value} />
      ))}
    </div>
  )
}
