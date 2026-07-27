import AuthenticatedMedia from '../common/AuthenticatedMedia.jsx'

export default function LifePostCover({ media, title }) {
  if (!media) return null
  return (
    <figure className="life-post-cover">
      <AuthenticatedMedia
        src={media.url}
        alt={title ? `${title}的封面` : '生活内容封面'}
        fit="natural"
        width={media.width}
        height={media.height}
        loading="eager"
      />
    </figure>
  )
}
