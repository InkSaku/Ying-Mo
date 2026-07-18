import { Link } from 'react-router-dom'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import AdaptiveMedia from '../common/AdaptiveMedia.jsx'
import PageContainer from '../layout/PageContainer'
import { heroMotion, presenceTransition } from '../../lib/motion.js'

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
}

function PostPreview({ post }) {
  if (!post) {
    return (
      <div className="home-live-card home-live-card--empty">
        <span className="home-live-card__placeholder" aria-hidden="true">生</span>
        <div><strong>等待第一条生活记录</strong><p>真实发布后，最新内容会出现在这里。</p></div>
      </div>
    )
  }

  return (
    <Link className="home-live-card" to={`/life/post/${post.id}`}>
      <span className="home-live-card__media">
        {post.cover_image
          ? <AdaptiveMedia src={post.cover_image} alt={`最新生活记录：${post.title}`} loading="eager" />
          : <span className="home-live-card__placeholder" aria-hidden="true">生</span>}
      </span>
      <span className="home-live-card__copy">
        <span className="home-live-card__meta">
          <span>{post.chapter?.name || '生活记录'}</span>
          <time dateTime={post.created_at}>{formatDate(post.created_at)}</time>
        </span>
        <strong>{post.title}</strong>
        <span>{post.excerpt || '把这一天留在这里。'}</span>
        <small>{post.author?.nickname || '映墨用户'} · {post.image_count || 0} 张照片</small>
      </span>
    </Link>
  )
}

function GamePreview({ game }) {
  const cover = game?.cover_thumbnail_url || game?.icon_thumbnail_url

  if (!game) {
    return (
      <div className="home-game-preview home-game-preview--empty">
        <span className="home-game-preview__mark" aria-hidden="true">游</span>
        <div><strong>游戏目录等待维护</strong><small>管理员录入后会同步展示。</small></div>
      </div>
    )
  }

  return (
    <Link className="home-game-preview" to={`/game/${game.slug}`}>
      <span className="home-game-preview__mark">
        {cover ? <img src={cover} alt="" /> : <span aria-hidden="true">游</span>}
      </span>
      <span>
        <small>{game.current_version || '游戏目录'}</small>
        <strong>{game.name_zh}</strong>
      </span>
      <span className="home-game-preview__stats">{game.hero_count} 位英雄 · {game.map_count} 张地图</span>
      <span aria-hidden="true">→</span>
    </Link>
  )
}

export default function HomeHero({ latestPost, latestGame, loading }) {
  const reducedMotion = useReducedMotion()
  const variants = heroMotion(reducedMotion)

  return (
    <section className="home-portal-hero" aria-labelledby="home-hero-title">
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
            <span>Yingmo community</span>
          </m.div>
          <m.h1 id="home-hero-title" variants={variants.item}>把生活留下，<br /><em>把经验讲清。</em></m.h1>
          <m.p className="home-portal-hero__lead" variants={variants.item}>一个同时承载生活影像与游戏知识的轻量社区。首页连接真实内容、明确入口和持续更新，而不是展示一组固定素材。</m.p>
          <m.div className="home-portal-hero__actions" variants={variants.item}>
            <Link className="button button--primary" to="/life">进入生活区</Link>
            <Link className="button" to="/games">浏览游戏区</Link>
          </m.div>
          <m.nav className="home-portal-hero__quick" aria-label="首页快捷入口" variants={variants.item}>
            <a href="#home-spaces">双区入口</a>
            <a href="#home-life-title">最新生活</a>
            <a href="#home-game-title">游戏与教材</a>
          </m.nav>
        </div>

        <m.div className="home-content-window" aria-label="社区最新内容预览" variants={variants.item}>
          <div className="home-content-window__header">
            <div><span /><span /><span /></div>
            <p>社区新近内容</p>
            <small>实时读取</small>
          </div>
          <div className="home-content-window__body">
            <AnimatePresence initial={false} mode="popLayout">
              {loading ? (
                <m.div
                  key="hero-loading"
                  className="home-content-window__skeleton"
                  role="status"
                  aria-label="正在读取社区新近内容"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={presenceTransition}
                >
                  <span /><span /><span />
                </m.div>
              ) : (
                <m.div
                  key="hero-content"
                  className="home-content-window__loaded"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={presenceTransition}
                >
                  <PostPreview post={latestPost} />
                  <GamePreview game={latestGame} />
                </m.div>
              )}
            </AnimatePresence>
          </div>
        </m.div>
        </m.div>
      </PageContainer>
    </section>
  )
}
