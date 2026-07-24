const FIT_MODES = new Set(['natural', 'contain', 'cover'])

function validDimension(value) {
  const number = Number(value)
  return Number.isFinite(number) && Number.isInteger(number) && number > 0 ? number : undefined
}

export default function AdaptiveMedia({
  src,
  alt = '',
  fit = 'contain',
  width,
  height,
  className = '',
  loading = 'lazy',
}) {
  if (!src) return null

  const resolvedFit = FIT_MODES.has(fit) ? fit : 'contain'
  const classes = ['adaptive-media', `adaptive-media--${resolvedFit}`, className].filter(Boolean).join(' ')
  const parsedWidth = validDimension(width)
  const parsedHeight = validDimension(height)
  const hasDimensions = parsedWidth !== undefined && parsedHeight !== undefined

  return (
    <span className={classes}>
      <img
        className="adaptive-media__image"
        src={src}
        alt={alt}
        width={hasDimensions ? parsedWidth : undefined}
        height={hasDimensions ? parsedHeight : undefined}
        loading={loading}
        decoding="async"
      />
    </span>
  )
}
