import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, domAnimation, LazyMotion, m, MotionConfig, useReducedMotion } from 'motion/react'
import { getGames } from '../api/games.js'
import { getGuides } from '../api/guides.js'
import { getLifeChapters, getLifePosts } from '../api/life.js'
import AdaptiveMedia from '../components/common/AdaptiveMedia.jsx'
import { GameCard } from '../components/games/CatalogCards'
import GuideCard from '../components/guides/GuideCard'
import HomeHero from '../components/home/HomeHero'
import ProductSpaceSection from '../components/home/ProductSpaceSection'
import PageContainer from '../components/layout/PageContainer'
import HomeLifePostCard from '../components/home/HomeLifePostCard.jsx'
import Reveal from '../components/motion/Reveal.jsx'
import { cappedStagger, pageEntrance, presenceTransition } from '../lib/motion.js'

const initialState = {
  posts: [],
  chapters: [],
  games: [],
  guides: [],
  postsError: null,
  chaptersError: null,
  gamesError: null,
  guidesError: null,
  postsLoading: true,
  chaptersLoading: true,
  gamesLoading: true,
  guidesLoading: true,
}

function getErrorMessage(result, fallback) {
  if (result.status !== 'rejected') return null
  return result.reason?.response?.data?.error?.message || result.reason?.message || fallback
}

function HomeSectionHeading({ eyebrow, title, description, actionLabel, to, titleId }) {
  return (
    <div className="home-section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={titleId}>{title}</h2>
        <p>{description}</p>
      </div>
      <Link className="home-section-heading__action" to={to}>
        {actionLabel}
        <span aria-hidden="true">↗</span>
      </Link>
    </div>
  )
}

function HomeSkeleton({ variant }) {
  const rows = variant === 'chapters' ? 5 : variant === 'guides' ? 3 : 4

  if (variant === 'life') {
    return (
      <div className="home-skeleton home-skeleton--life" role="status" aria-label="正在读取生活记录">
        <span className="home-skeleton__featured"><i /><b><em /><em /><em /></b></span>
        <span className="home-skeleton__cards"><i /><i /><i /></span>
      </div>
    )
  }

  return (
    <div className={`home-skeleton home-skeleton--${variant}`} role="status" aria-label="正在读取社区内容">
      {Array.from({ length: rows }, (_, index) => (
        <span className="home-skeleton__row" key={index}><i /><b><em /><em /></b></span>
      ))}
    </div>
  )
}

function HomeState({ loading, error, empty, emptyText = '这一页还在等第一笔。', variant = 'default', children }) {
  const stateKey = loading ? 'loading' : error ? 'error' : empty ? 'empty' : 'content'
  let content = children

  if (loading) content = <HomeSkeleton variant={variant} />
  if (error) content = <div className="home-state home-state--error" role="alert">{error}</div>
  if (empty) content = <div className="home-state">{emptyText}</div>

  return (
    <div className="home-state-stage">
      <AnimatePresence initial={false}>
        <m.div
          className="home-state-transition"
          key={stateKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={presenceTransition}
        >
          {content}
        </m.div>
      </AnimatePresence>
    </div>
  )
}

function ChapterPreview({ chapter }) {
  return (
    <Link className="home-chapter-item" to={`/life/chapter/${chapter.slug}`}>
      <span className="home-chapter-item__cover">
        {chapter.cover_thumbnail_url
          ? <AdaptiveMedia src={chapter.cover_thumbnail_url} alt="" fit="contain" />
          : <span aria-hidden="true">章</span>}
      </span>
      <span className="home-chapter-item__copy">
        <strong>{chapter.name}</strong>
        <small>{chapter.content_count} 条记录 · {chapter.contributor_count} 位参与者</small>
      </span>
      <span className="home-chapter-item__arrow" aria-hidden="true">→</span>
    </Link>
  )
}

export default function HomePage() {
  const [home, setHome] = useState(initialState)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    let cancelled = false

    Promise.allSettled([
      getLifePosts({ page: 1, page_size: 4, scope: 'latest' }),
      getLifeChapters({ page: 1, page_size: 5, sort: 'popular' }),
      getGames({ page: 1, page_size: 4, sort: 'latest' }),
      getGuides({ page: 1, page_size: 3, sort: 'latest' }),
    ]).then(([posts, chapters, games, guides]) => {
      if (cancelled) return

      setHome({
        posts: posts.status === 'fulfilled' ? posts.value.data : [],
        chapters: chapters.status === 'fulfilled' ? chapters.value.data : [],
        games: games.status === 'fulfilled' ? games.value.data : [],
        guides: guides.status === 'fulfilled' ? guides.value.data : [],
        postsError: getErrorMessage(posts, '生活内容暂时无法加载。'),
        chaptersError: getErrorMessage(chapters, '生活章节暂时无法加载。'),
        gamesError: getErrorMessage(games, '游戏目录暂时无法加载。'),
        guidesError: getErrorMessage(guides, '点位暂时无法加载。'),
        postsLoading: false,
        chaptersLoading: false,
        gamesLoading: false,
        guidesLoading: false,
      })
    })

    return () => { cancelled = true }
  }, [])

  const [featuredPost, ...secondaryPosts] = home.posts

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
      <m.div className="home-page" {...pageEntrance(reducedMotion)}>
      <HomeHero
        latestPost={home.posts[0]}
        latestGame={home.games[0]}
        loading={home.postsLoading || home.gamesLoading}
        visualData={{
          posts: home.posts,
          chapters: home.chapters,
          games: home.games,
          guides: home.guides,
        }}
      />

        <ProductSpaceSection latestPost={home.posts[0]} latestGame={home.games[0]} />

      <section className="home-domain-section home-domain-section--life" aria-labelledby="home-life-title">
        <PageContainer>
          <Reveal>
            <HomeSectionHeading
            eyebrow="日常 · 新近留下"
            title="一些日子，正被轻轻留下"
            description="照片记得光线，文字记得当时。这里是大家最近写下的生活。"
            actionLabel="翻看更多日常"
            to="/life"
            titleId="home-life-title"
            />
          </Reveal>

          <div className="home-life-layout">
            <div className="home-life-feed">
              <HomeState loading={home.postsLoading} error={home.postsError} empty={!home.posts.length} emptyText="这里还空着，等一张照片或一句当时的话。" variant="life">
                <div className="home-life-showcase">
                  {featuredPost && (
                    <Reveal className="home-motion-card">
                      <HomeLifePostCard post={featuredPost} featured />
                    </Reveal>
                  )}
                  {secondaryPosts.length > 0 && (
                    <div className="home-life-showcase__secondary">
                      {secondaryPosts.map((post, index) => (
                        <Reveal className="home-motion-card" delay={cappedStagger(index + 1)} key={post.id}>
                          <HomeLifePostCard post={post} />
                        </Reveal>
                      ))}
                    </div>
                  )}
                </div>
              </HomeState>
            </div>

            <Reveal className="home-motion-rail">
            <aside className="home-chapter-rail" aria-labelledby="home-chapter-title">
              <div className="home-chapter-rail__heading">
                <div>
                  <p className="eyebrow">城市与故事</p>
                  <h3 id="home-chapter-title">沿着地名与记忆翻页</h3>
                </div>
                <Link to="/life/chapters" aria-label="查看全部生活章节">全部</Link>
              </div>
              <HomeState loading={home.chaptersLoading} error={home.chaptersError} empty={!home.chapters.length} emptyText="还没有合集，等一些相近的日子在这里相遇。" variant="chapters">
                <div className="home-chapter-list">
                  {home.chapters.map((chapter, index) => (
                    <Reveal delay={cappedStagger(index)} key={chapter.id}>
                      <ChapterPreview chapter={chapter} />
                    </Reveal>
                  ))}
                </div>
              </HomeState>
            </aside>
            </Reveal>
          </div>
        </PageContainer>
      </section>

      <section className="home-domain-section home-domain-section--game" aria-labelledby="home-game-title">
        <PageContainer>
          <Reveal>
            <HomeSectionHeading
            eyebrow="点位 · 地图与英雄"
            title="地图之外，也有人替你留了路"
            description="先选地图，再选英雄。站位、路线与投掷时机，都在一篇篇可以照着复现的点位里。"
            actionLabel="去找点位"
            to="/games"
            titleId="home-game-title"
            />
          </Reveal>

          <div className="home-game-layout">
            <div className="home-game-catalog">
              <div className="home-subsection-heading">
                <div>
                  <span>游戏与地图</span>
                  <strong>从下一张地图出发</strong>
                </div>
                <Link to="/games">查看目录</Link>
              </div>
              <HomeState loading={home.gamesLoading} error={home.gamesError} empty={!home.games.length} emptyText="地图册还在展开，稍后再来看看。" variant="games">
                <div className="catalog-grid home-game-grid">
                  {home.games.map((game, index) => (
                    <Reveal className="home-motion-card" delay={cappedStagger(index)} key={game.id}>
                      <GameCard game={game} />
                    </Reveal>
                  ))}
                </div>
              </HomeState>
            </div>

            <div className="home-guide-panel">
              <div className="home-subsection-heading">
                <div>
                  <span>新近点位</span>
                  <strong>队友刚留下的路标</strong>
                </div>
                <Link to="/guides">查看全部</Link>
              </div>
              <HomeState loading={home.guidesLoading} error={home.guidesError} empty={!home.guides.length} emptyText="还没有人落下第一枚路标。" variant="guides">
                <div className="home-guide-list">
                  {home.guides.map((guide, index) => (
                    <Reveal className="home-motion-card" delay={cappedStagger(index)} key={guide.id}>
                      <GuideCard guide={guide} />
                    </Reveal>
                  ))}
                </div>
              </HomeState>
            </div>
          </div>
        </PageContainer>
      </section>

      <section className="home-final-entry">
        <PageContainer>
          <Reveal>
          <div className="home-final-entry__panel">
            <div>
              <p className="eyebrow">再往里走走</p>
              <h2>看看别人留下的，也写下自己的那一笔。</h2>
              <p>随意翻翻新近的日常与点位；若你愿意，也把某个值得记住的瞬间或走法留在这里。</p>
            </div>
            <div className="home-final-entry__actions">
              <Link className="button button--primary" to="/discover">随意走走</Link>
              <Link className="button" to="/publish">留下一笔</Link>
            </div>
          </div>
          </Reveal>
        </PageContainer>
      </section>
      </m.div>
      </MotionConfig>
    </LazyMotion>
  )
}
