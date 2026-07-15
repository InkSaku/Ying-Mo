export default function AdaptiveMedia({ src, alt = '', className = '', fit = 'contain', loading = 'lazy' }) {
  if (!src) return null

  const classes = ['adaptive-media', `adaptive-media--${fit}`, className].filter(Boolean).join(' ')

  return (
    <span className={classes}>
      {fit === 'contain' && <img className="adaptive-media__backdrop" src={src} alt="" aria-hidden="true" loading={loading} decoding="async" />}
      <img className="adaptive-media__image" src={src} alt={alt} loading={loading} decoding="async" />
    </span>
  )
}
