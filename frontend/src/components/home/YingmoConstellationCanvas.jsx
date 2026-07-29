import { useEffect, useMemo, useRef } from 'react'

const TAU = Math.PI * 2

// 保留北斗七星的骨架，但通过“星核材质 + 绕行环 + 光迹尾迹”做精修。
const DIPPER = [
  [0.00, 0.22],
  [0.18, 0.07],
  [0.39, 0.12],
  [0.54, 0.29],
  [0.69, 0.21],
  [0.84, 0.31],
  [1.00, 0.23],
]

const FOLLOW_STIFFNESS = [10.6, 5.9, 3.6, 2.25]
const TRAIL_ALPHA = [1, 0.28, 0.12, 0.045]

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function numeric(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function hashString(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededRandom(seed) {
  let value = seed >>> 0
  return () => {
    value += 0x6D2B79F5
    let result = value
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

function contentSignature(data) {
  const posts = data?.posts ?? []
  const chapters = data?.chapters ?? []
  const games = data?.games ?? []
  const guides = data?.guides ?? []

  const parts = [
    ...posts.map((item) => `p:${item.id ?? item.title ?? ''}:${item.image_count ?? item.media_count ?? 0}`),
    ...chapters.map((item) => `c:${item.id ?? item.slug ?? item.name ?? ''}:${item.content_count ?? 0}`),
    ...games.map((item) => `g:${item.id ?? item.slug ?? item.name_zh ?? ''}:${item.hero_count ?? 0}:${item.map_count ?? 0}`),
    ...guides.map((item) => `d:${item.id ?? item.slug ?? item.title ?? ''}`),
  ]

  return parts.length ? parts.join('|') : 'yingmo:constellation-v6'
}

function dataSignals(data) {
  const posts = data?.posts ?? []
  const chapters = data?.chapters ?? []
  const games = data?.games ?? []
  const guides = data?.guides ?? []

  const mediaCount = posts.reduce(
    (sum, post) => sum + Math.max(1, numeric(post.media_count ?? post.image_count)),
    0,
  )
  const chapterContent = chapters.reduce((sum, chapter) => sum + numeric(chapter.content_count), 0)
  const gameStructure = games.reduce(
    (sum, game) => sum + numeric(game.hero_count) + numeric(game.map_count),
    0,
  )

  return {
    life: clamp((posts.length * 2 + mediaCount * 0.35 + chapterContent * 0.06) / 12, 0.28, 1),
    game: clamp((games.length * 2 + guides.length * 1.4 + gameStructure * 0.05) / 12, 0.28, 1),
  }
}

function readPalette() {
  const styles = getComputedStyle(document.documentElement)
  return {
    life: styles.getPropertyValue('--color-primary').trim() || '#2f8373',
    game: styles.getPropertyValue('--color-game').trim() || '#56796f',
    quiet: styles.getPropertyValue('--color-text-subtle').trim() || '#8a948d',
    surface: styles.getPropertyValue('--color-surface').trim() || '#fffefa',
    shadow: styles.getPropertyValue('--color-text').trim() || '#20231f',
  }
}

function hexToRgb(color) {
  const match = /^#([0-9a-f]{6})$/i.exec(color.trim())
  if (!match) return null
  const value = Number.parseInt(match[1], 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function rgba(color, alpha) {
  const rgb = hexToRgb(color)
  if (!rgb) return color
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

function mixColor(a, b, ratio) {
  const rgbA = hexToRgb(a)
  const rgbB = hexToRgb(b)
  if (!rgbA || !rgbB) return a
  const r = Math.round(rgbA.r * (1 - ratio) + rgbB.r * ratio)
  const g = Math.round(rgbA.g * (1 - ratio) + rgbB.g * ratio)
  const bValue = Math.round(rgbA.b * (1 - ratio) + rgbB.b * ratio)
  return `rgb(${r}, ${g}, ${bValue})`
}

function createConstellations(seed, signals) {
  const random = seededRandom(seed)

  return [
    {
      kind: 'life',
      depth: 0.67,
      phase: random() * TAU,
      speed: 0.10 + random() * 0.022,
      driftX: 18 + random() * 8,
      driftY: 12 + random() * 7,
      followX: 58,
      followY: 31,
      signal: signals.life,
      opacity: 0.72,
      primaryNodes: new Set([1, 3, 6]),
      ringNodes: new Set([3]),
      layouts: {
        desktop: { cx: 0.115, cy: 0.235, scale: 0.255, rotation: -0.2, opacity: 0.92, follow: 0.92, nodeScale: 1, rings: true, detail: true },
        compact: { cx: 0.09, cy: 0.22, scale: 0.215, rotation: -0.24, opacity: 0.76, follow: 0.72, nodeScale: 0.92, rings: true, detail: true },
        mobile: { cx: 0.035, cy: 0.16, scale: 0.155, rotation: -0.3, opacity: 0.48, follow: 0.38, nodeScale: 0.78, rings: false, detail: false },
      },
    },
    {
      kind: 'game',
      depth: 0.84,
      phase: random() * TAU,
      speed: 0.075 + random() * 0.018,
      driftX: 22 + random() * 9,
      driftY: 13 + random() * 6,
      followX: 72,
      followY: 39,
      signal: signals.game,
      opacity: 0.76,
      primaryNodes: new Set([0, 3, 5]),
      ringNodes: new Set([5]),
      layouts: {
        desktop: { cx: 0.895, cy: 0.79, scale: 0.255, rotation: 0.18, opacity: 0.95, follow: 0.9, nodeScale: 1, rings: true, detail: true },
        compact: { cx: 0.92, cy: 0.78, scale: 0.215, rotation: 0.23, opacity: 0.76, follow: 0.68, nodeScale: 0.92, rings: true, detail: true },
        mobile: { cx: 0.965, cy: 0.86, scale: 0.16, rotation: 0.3, opacity: 0.48, follow: 0.34, nodeScale: 0.78, rings: false, detail: false },
      },
    },
    {
      kind: 'quiet',
      depth: 0.42,
      phase: random() * TAU,
      speed: 0.056 + random() * 0.014,
      driftX: 10 + random() * 5,
      driftY: 8 + random() * 4,
      followX: 34,
      followY: 20,
      signal: (signals.life + signals.game) * 0.5,
      opacity: 0.25,
      primaryNodes: new Set([2, 4]),
      ringNodes: new Set(),
      layouts: {
        desktop: { cx: 0.59, cy: 0.105, scale: 0.125, rotation: -0.38, opacity: 0.72, follow: 0.58, nodeScale: 0.82, rings: false, detail: false },
        compact: { cx: 0.62, cy: 0.09, scale: 0.105, rotation: -0.42, opacity: 0.45, follow: 0.42, nodeScale: 0.72, rings: false, detail: false },
        mobile: { cx: 0.76, cy: 0.075, scale: 0.085, rotation: -0.5, opacity: 0.16, follow: 0.2, nodeScale: 0.62, rings: false, detail: false },
      },
    },
  ]
}

function resolveLayout(constellation, width) {
  if (width < 720) return constellation.layouts.mobile
  if (width < 1080) return constellation.layouts.compact
  return constellation.layouts.desktop
}

function transformPoint(point, constellation, layout, width, height, time, follow, reducedMotion) {
  const motion = reducedMotion ? 0 : 1
  const baseScale = Math.min(width * layout.scale, height * layout.scale * 1.72)
  const localX = (point[0] - 0.5) * baseScale
  const localY = (point[1] - 0.18) * baseScale
  const angle = layout.rotation
    + Math.sin(time * constellation.speed * 0.42 + constellation.phase) * 0.026 * motion
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const rotatedX = localX * cos - localY * sin
  const rotatedY = localX * sin + localY * cos

  const driftX = Math.sin(time * constellation.speed + constellation.phase) * constellation.driftX * motion
  const driftY = Math.cos(time * constellation.speed * 0.83 + constellation.phase) * constellation.driftY * motion
  const followOffsetX = follow.x * constellation.followX * constellation.depth * layout.follow * motion
  const followOffsetY = follow.y * constellation.followY * constellation.depth * layout.follow * motion

  return {
    x: layout.cx * width + rotatedX + driftX + followOffsetX,
    y: layout.cy * height + rotatedY + driftY + followOffsetY,
  }
}

function drawGlow(context, x, y, radius, color, alpha) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, rgba(color, alpha))
  gradient.addColorStop(0.24, rgba(color, alpha * 0.42))
  gradient.addColorStop(0.62, rgba(color, alpha * 0.1))
  gradient.addColorStop(1, rgba(color, 0))
  context.fillStyle = gradient
  context.beginPath()
  context.arc(x, y, radius, 0, TAU)
  context.fill()
}

function drawRingArc(context, x, y, radius, tilt, alpha, color, frontHalf) {
  context.save()
  context.translate(x, y)
  context.rotate(tilt)
  context.scale(1.72, 0.58)
  context.strokeStyle = rgba(color, alpha)
  context.lineWidth = Math.max(0.45, radius * 0.12)
  context.beginPath()
  if (frontHalf) context.arc(0, 0, radius * 2, 0.18 * Math.PI, 0.82 * Math.PI)
  else context.arc(0, 0, radius * 2, 1.18 * Math.PI, 1.82 * Math.PI)
  context.stroke()
  context.restore()
}

function drawPlanetNode(context, x, y, radius, baseColor, palette, options) {
  const {
    alpha,
    glowAlpha,
    showRing,
    ringAlpha,
    ringTilt,
    trailIndex,
    isPrimary,
  } = options

  const highlightColor = mixColor(baseColor, palette.surface, 0.62)
  const coreColor = mixColor(baseColor, palette.surface, 0.24)
  const shadowColor = mixColor(baseColor, palette.shadow, 0.18)

  // 拖影层尽量只保留柔和发光，不像复制了一套完整节点。
  drawGlow(context, x, y, radius * (6.8 - trailIndex * 1.15), baseColor, glowAlpha)

  if (showRing) {
    drawRingArc(context, x, y, radius, ringTilt, ringAlpha * 0.5, highlightColor, false)
  }

  const bodyGradient = context.createRadialGradient(
    x - radius * 0.34,
    y - radius * 0.42,
    radius * 0.1,
    x + radius * 0.12,
    y + radius * 0.14,
    radius * 1.15,
  )
  bodyGradient.addColorStop(0, rgba(highlightColor, alpha * 0.98))
  bodyGradient.addColorStop(0.24, rgba(coreColor, alpha * 0.96))
  bodyGradient.addColorStop(0.72, rgba(baseColor, alpha * 0.94))
  bodyGradient.addColorStop(1, rgba(shadowColor, alpha * 0.94))

  context.fillStyle = bodyGradient
  context.beginPath()
  context.arc(x, y, radius, 0, TAU)
  context.fill()

  context.fillStyle = rgba(highlightColor, alpha * (isPrimary ? 0.3 : 0.22))
  context.beginPath()
  context.arc(x - radius * 0.28, y - radius * 0.32, Math.max(0.55, radius * 0.23), 0, TAU)
  context.fill()

  context.fillStyle = rgba(palette.surface, alpha * 0.16)
  context.beginPath()
  context.arc(x - radius * 0.18, y - radius * 0.16, Math.max(0.4, radius * 0.08), 0, TAU)
  context.fill()

  if (showRing) {
    drawRingArc(context, x, y, radius, ringTilt, ringAlpha, highlightColor, true)
  }
}

function drawLink(context, from, to, color, alpha, width) {
  const gradient = context.createLinearGradient(from.x, from.y, to.x, to.y)
  gradient.addColorStop(0, rgba(color, alpha * 0.55))
  gradient.addColorStop(0.5, rgba(color, alpha))
  gradient.addColorStop(1, rgba(color, alpha * 0.55))
  context.strokeStyle = gradient
  context.lineWidth = width
  context.lineCap = 'round'
  context.beginPath()
  context.moveTo(from.x, from.y)
  context.lineTo(to.x, to.y)
  context.stroke()
}

function drawTravelingGlow(context, from, to, color, intensity, t) {
  const x = from.x + (to.x - from.x) * t
  const y = from.y + (to.y - from.y) * t
  drawGlow(context, x, y, 7, color, intensity)
}

export default function YingmoConstellationCanvas({ data, reducedMotion = false }) {
  const canvasRef = useRef(null)
  const signature = useMemo(() => contentSignature(data), [data])
  const signals = useMemo(() => dataSignals(data), [data])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d', { alpha: true })
    if (!canvas || !context) return undefined

    const constellations = createConstellations(hashString(signature), signals)
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 }
    const follow = FOLLOW_STIFFNESS.map(() => ({ x: 0, y: 0 }))
    let palette = readPalette()
    let width = 1
    let height = 1
    let pixelRatio = 1
    let animationFrame = 0
    let visible = true
    let lastTime = performance.now()

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75)
      canvas.width = Math.round(width * pixelRatio)
      canvas.height = Math.round(height * pixelRatio)
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    }

    const drawConstellationLayer = (constellation, time, layerIndex) => {
      const baseColor = palette[constellation.kind]
      const layout = resolveLayout(constellation, width)
      const effectiveOpacity = constellation.opacity * layout.opacity
      if (effectiveOpacity < 0.01) return

      const points = DIPPER.map((point) => (
        transformPoint(point, constellation, layout, width, height, time, follow[layerIndex], reducedMotion)
      ))

      const signal = constellation.signal
      const layerAlpha = TRAIL_ALPHA[layerIndex]
      const isMain = layerIndex === 0
      const isQuiet = constellation.kind === 'quiet'

      // 连线更轻，避免压过节点。
      for (let index = 1; index < points.length; index += 1) {
        const from = points[index - 1]
        const to = points[index]
        const lineAlpha = effectiveOpacity * (0.14 + signal * 0.16) * layerAlpha * (isMain ? 1 : 0.82)
        if (lineAlpha > 0.008) {
          drawLink(
            context,
            from,
            to,
            baseColor,
            lineAlpha,
            (0.82 + signal * 0.48) * (isMain ? 1 : 0.88),
          )
        }
      }

      // 主层给生活/游戏星图增加很克制的流动高光。
      if (isMain && !isQuiet && !reducedMotion && layout.detail) {
        const segmentIndex = constellation.kind === 'life' ? 2 : 4
        const from = points[segmentIndex]
        const to = points[segmentIndex + 1]
        const t = (Math.sin(time * 0.65 + constellation.phase) + 1) / 2
        drawTravelingGlow(context, from, to, baseColor, 0.1 + signal * 0.05, t)
      }

      points.forEach((point, index) => {
        const isPrimary = constellation.primaryNodes.has(index)
        const showRing = isMain && layout.rings && constellation.ringNodes.has(index)
        const pulse = reducedMotion
          ? 1
          : 0.95 + Math.sin(time * 0.72 + constellation.phase + index * 0.92) * 0.05

        const radiusBase = isPrimary ? 5.1 : 3.55
        const radius = radiusBase * layout.nodeScale * (0.86 + signal * 0.24) * pulse * (isQuiet ? 0.8 : 1) * (isMain ? 1 : 0.96)
        const alpha = (isPrimary ? 0.84 : 0.68) * effectiveOpacity * layerAlpha * (isMain ? 1 : 0.64)
        const glowAlpha = (isPrimary ? 0.17 : 0.1) * effectiveOpacity * layerAlpha * (0.92 + signal * 0.32)
        const ringAlpha = 0.16 * effectiveOpacity * layerAlpha

        drawPlanetNode(context, point.x, point.y, radius, baseColor, palette, {
          alpha,
          glowAlpha,
          showRing,
          ringAlpha,
          ringTilt: -0.34 + index * 0.06,
          trailIndex: layerIndex,
          isPrimary,
        })
      })
    }

    const draw = (now) => {
      const delta = Math.min(32, now - lastTime)
      lastTime = now
      const time = now / 1000

      const easingBase = reducedMotion ? 1 : 1 - Math.pow(0.001, delta / 1000)
      pointer.x += (pointer.targetX - pointer.x) * easingBase
      pointer.y += (pointer.targetY - pointer.y) * easingBase

      follow.forEach((layer, index) => {
        const stiffness = FOLLOW_STIFFNESS[index]
        const targetX = index === 0 ? pointer.x : follow[index - 1].x
        const targetY = index === 0 ? pointer.y : follow[index - 1].y
        const blend = reducedMotion ? 1 : 1 - Math.exp(-stiffness * delta / 1000)
        layer.x += (targetX - layer.x) * blend
        layer.y += (targetY - layer.y) * blend
      })

      context.clearRect(0, 0, width, height)

      constellations.forEach((constellation) => drawConstellationLayer(constellation, time, 3))
      constellations.forEach((constellation) => drawConstellationLayer(constellation, time, 2))
      constellations.forEach((constellation) => drawConstellationLayer(constellation, time, 1))
      constellations.forEach((constellation) => drawConstellationLayer(constellation, time, 0))

      if (!reducedMotion && visible) animationFrame = requestAnimationFrame(draw)
    }

    const onPointerMove = (event) => {
      if (reducedMotion) return
      const rect = canvas.getBoundingClientRect()
      const inside = event.clientX >= rect.left && event.clientX <= rect.right
        && event.clientY >= rect.top && event.clientY <= rect.bottom

      if (!inside) {
        pointer.targetX = 0
        pointer.targetY = 0
        return
      }

      const nx = clamp((event.clientX - rect.left) / rect.width) * 2 - 1
      const ny = clamp((event.clientY - rect.top) / rect.height) * 2 - 1
      const reach = rect.width < 720 ? 0.68 : rect.width < 1080 ? 0.84 : 1
      pointer.targetX = nx * reach
      pointer.targetY = ny * reach
    }

    const onPointerLeave = () => {
      pointer.targetX = 0
      pointer.targetY = 0
    }

    const resizeObserver = new ResizeObserver(() => {
      resize()
      if (reducedMotion) draw(performance.now())
    })

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      const nextVisible = entry.isIntersecting
      if (nextVisible === visible) return
      visible = nextVisible
      cancelAnimationFrame(animationFrame)
      if (visible && !reducedMotion) {
        lastTime = performance.now()
        animationFrame = requestAnimationFrame(draw)
      }
    }, { rootMargin: '100px' })

    const themeObserver = new MutationObserver(() => {
      palette = readPalette()
      if (reducedMotion) draw(performance.now())
    })

    resize()
    resizeObserver.observe(canvas)
    intersectionObserver.observe(canvas)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerleave', onPointerLeave)

    if (reducedMotion) draw(performance.now())
    else animationFrame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      themeObserver.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [reducedMotion, signature, signals])

  return (
    <div className="home-hero-constellations" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}
