import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { m, useReducedMotion } from 'motion/react'
import AdaptiveMedia from '../common/AdaptiveMedia.jsx'
import PageContainer from '../layout/PageContainer'
import { heroMotion } from '../../lib/motion.js'
import YingmoConstellationCanvas from './YingmoConstellationCanvas.jsx'

const AUTO_ADVANCE_MS = 3800

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
}

function joinMeta(parts) {
  return parts.filter(Boolean).slice(0, 2).join(' · ')
}

function buildStorySlides(data) {
  const posts = data?.posts ?? []
  const chapters = data?.chapters ?? []
  const games = data?.games ?? []
  const guides = data?.guides ?? []
  const slides = []

  const addPost = (post) => {
    if (!post) return
    slides.push({
      id: `post-${post.id}`,
      kind: 'life',
      label: '生活记录',
      title: post.title,
      description: post.excerpt || '把这一天留在这里。',
      meta: joinMeta([post.chapter?.name || post.author?.nickname || '映墨用户', formatDate(post.created_at)]),
      image: post.cover_image,
      imageAlt: post.cover_image ? `${post.title}的生活照片` : '',
      imageWidth: post.cover_width,
      imageHeight: post.cover_height,
      placeholder: '生',
      to: `/life/post/${post.id}`,
    })
  }

  addPost(posts[0])

  if (guides[0]) {
    const guide = guides[0]
    slides.push({
      id: `guide-${guide.id}`,
      kind: 'guide',
      label: '游戏点位',
      title: guide.title,
      description: guide.excerpt || '打开教程，查看站位、方向与操作步骤。',
      meta: joinMeta([guide.map?.name_zh, guide.hero?.name_zh]),
      image: guide.cover_image,
      imageAlt: guide.cover_image ? `${guide.title}的点位示意图` : '',
      imageWidth: guide.cover_width,
      imageHeight: guide.cover_height,
      placeholder: '点',
      to: `/guide/${guide.id}`,
    })
  }

  addPost(posts[1])

  if (chapters[0]) {
    const chapter = chapters[0]
    slides.push({
      id: `chapter-${chapter.id}`,
      kind: 'chapter',
      label: '生活合集',
      title: chapter.name,
      description: chapter.description || '一些相近的日子，在这里慢慢聚成一册。',
      meta: joinMeta([
        `${chapter.content_count || 0} 条记录`,
        `${chapter.contributor_count || 0} 位参与者`,
      ]),
      image: chapter.cover_thumbnail_url || chapter.cover_url,
      imageAlt: chapter.cover_thumbnail_url || chapter.cover_url ? `${chapter.name}合集封面` : '',
      placeholder: '章',
      to: `/life/chapter/${chapter.slug}`,
    })
  }

  if (games[0]) {
    const game = games[0]
    slides.push({
      id: `game-${game.id}`,
      kind: 'game',
      label: '地图目录',
      title: game.name_zh,
      description: game.description || '先选地图，再选择英雄和可以直接复现的点位。',
      meta: joinMeta([
        `${game.usable_map_count ?? game.map_count ?? 0} 张地图`,
        `${game.active_hero_count ?? game.hero_count ?? 0} 位英雄`,
      ]),
      image: game.cover_thumbnail_url || game.cover_url || game.icon_thumbnail_url || game.icon_url,
      imageAlt: game.cover_thumbnail_url || game.cover_url || game.icon_thumbnail_url || game.icon_url ? `${game.name_zh}目录封面` : '',
      placeholder: '游',
      to: `/game/${game.slug}/maps`,
    })
  }

  if (!slides.length) {
    return [
      {
        id: 'empty-life',
        kind: 'life',
        label: '生活记录',
        title: '这里还空着一页',
        description: '第一段日常，会从一张照片或一句话开始。',
        meta: '等待第一笔记录',
        placeholder: '生',
        to: '/life',
      },
      {
        id: 'empty-game',
        kind: 'game',
        label: '地图目录',
        title: '路标还在准备',
        description: '地图与英雄齐备后，就从这里出发。',
        meta: '等待第一条点位',
        placeholder: '游',
        to: '/games',
      },
    ]
  }

  return slides.slice(0, 5)
}

function slidePosition(index, activeIndex, count) {
  let offset = index - activeIndex
  if (offset > count / 2) offset -= count
  if (offset < -count / 2) offset += count
  if (offset === 0) return 'active'
  if (offset === 1) return 'next'
  if (offset === -1) return 'previous'
  return offset > 0 ? 'next-far' : 'previous-far'
}

function StorySlide({ slide, position }) {
  const isActive = position === 'active'

  return (
    <article
      className={`home-story-slide home-story-slide--${slide.kind} is-${position}`}
      aria-hidden={!isActive}
    >
      <Link
        className="home-story-slide__link"
        to={slide.to}
        tabIndex={isActive ? 0 : -1}
        aria-label={`${slide.label}：${slide.title}`}
      >
        <span className="home-story-slide__media">
          {slide.image ? (
            <>
              <span className="home-story-slide__media-backdrop" aria-hidden="true">
                <AdaptiveMedia src={slide.image} alt="" fit="cover" width={slide.imageWidth} height={slide.imageHeight} loading="lazy" />
              </span>
              <span className="home-story-slide__media-foreground">
                <AdaptiveMedia src={slide.image} alt={slide.imageAlt} fit="contain" width={slide.imageWidth} height={slide.imageHeight} loading={isActive ? 'eager' : 'lazy'} />
              </span>
            </>
          ) : <span className="home-story-slide__placeholder" aria-hidden="true">{slide.placeholder}</span>}
        </span>
        <span className="home-story-slide__body">
          <span className="home-story-slide__type">{slide.label}</span>
          <strong>{slide.title}</strong>
          <span className="home-story-slide__description">{slide.description}</span>
          <small>{slide.meta}</small>
        </span>
      </Link>
    </article>
  )
}

function StoryRail({ data, loading }) {
  const slides = useMemo(() => buildStorySlides(data), [data])
  const reducedMotion = useReducedMotion()
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const pointerStart = useRef(null)
  const suppressClick = useRef(false)
  const currentIndex = slides.length ? activeIndex % slides.length : 0

  const move = (direction) => {
    if (slides.length < 2) return
    setActiveIndex((index) => (index + direction + slides.length) % slides.length)
  }

  useEffect(() => {
    if (loading || reducedMotion || paused || slides.length < 2) return undefined
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length)
    }, AUTO_ADVANCE_MS)
    return () => window.clearInterval(timer)
  }, [loading, paused, reducedMotion, slides.length])

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    pointerStart.current = { x: event.clientX, y: event.clientY }
  }

  const handlePointerUp = (event) => {
    if (!pointerStart.current) return
    const deltaX = event.clientX - pointerStart.current.x
    const deltaY = event.clientY - pointerStart.current.y
    pointerStart.current = null
    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) <= Math.abs(deltaY)) return
    suppressClick.current = true
    move(deltaX < 0 ? 1 : -1)
    window.setTimeout(() => { suppressClick.current = false }, 0)
  }

  return (
    <div
      className="home-story-rail"
      role="region"
      aria-roledescription="轮播"
      aria-label="映墨新近内容"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { pointerStart.current = null }}
      onClickCapture={(event) => {
        if (suppressClick.current) event.preventDefault()
      }}
    >
      <header className="home-story-rail__header">
        <div>
          <strong>新近内容</strong>
          <small>生活记录与游戏点位</small>
        </div>
        <div className="home-story-rail__controls" aria-label="切换内容">
          <button type="button" onClick={() => move(-1)} aria-label="查看上一项" disabled={loading || slides.length < 2}>←</button>
          <button type="button" onClick={() => move(1)} aria-label="查看下一项" disabled={loading || slides.length < 2}>→</button>
        </div>
      </header>

      {loading ? (
        <div className="home-story-rail__skeleton" role="status" aria-label="正在读取社区新近内容">
          <span /><span /><span />
        </div>
      ) : (
        <div className="home-story-rail__track">
          {slides.map((slide, index) => (
            <StorySlide
              key={slide.id}
              slide={slide}
              position={slidePosition(index, currentIndex, slides.length)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function HomeHero({ latestPost, latestGame, loading, visualData }) {
  const reducedMotion = useReducedMotion()
  const variants = heroMotion(reducedMotion)

  const storyData = useMemo(() => ({
    posts: visualData?.posts?.length ? visualData.posts : latestPost ? [latestPost] : [],
    chapters: visualData?.chapters ?? [],
    games: visualData?.games?.length ? visualData.games : latestGame ? [latestGame] : [],
    guides: visualData?.guides ?? [],
  }), [latestGame, latestPost, visualData])

  return (
    <section className="home-portal-hero" aria-labelledby="home-hero-title">
      <YingmoConstellationCanvas data={visualData} reducedMotion={Boolean(reducedMotion)} />
      <PageContainer>
        <m.div
          className="home-portal-hero__inner"
          variants={variants.container}
          initial="hidden"
          animate="visible"
        >
          <div className="home-portal-hero__copy">
            <m.div className="home-brand-line" variants={variants.item}>
              <span className="home-brand-line__mark">映墨</span>
              <span>Yingmo · Notes &amp; Waypoints</span>
            </m.div>
            <m.h1 id="home-hero-title" variants={variants.item}>日常有光，<br /><em>地图有路。</em></m.h1>
            <m.p className="home-portal-hero__lead" variants={variants.item}>一张照片有它的天气与去处；一个点位有清楚的地图、英雄与走法。慢慢记录，也让真正有用的经验被后来的人找到。</m.p>
            <m.div className="home-portal-hero__actions" variants={variants.item}>
              <Link className="button button--primary" to="/life">翻看日常</Link>
              <Link className="button" to="/games">寻找点位</Link>
            </m.div>
            <m.nav className="home-portal-hero__quick" aria-label="首页快捷入口" variants={variants.item}>
              <a href="#home-spaces">两处空间</a>
              <a href="#home-life-title">新近日常</a>
              <a href="#home-game-title">地图与点位</a>
            </m.nav>
          </div>

          <m.div className="home-portal-hero__visual" variants={variants.item}>
            <StoryRail data={storyData} loading={loading} />
          </m.div>
        </m.div>
      </PageContainer>
    </section>
  )
}
