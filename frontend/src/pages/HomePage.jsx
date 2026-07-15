import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getGames } from '../api/games.js'
import { getGuides } from '../api/guides.js'
import { getLifeChapters, getLifePosts } from '../api/life.js'
import AdaptiveMedia from '../components/common/AdaptiveMedia.jsx'
import { GameCard } from '../components/games/CatalogCards'
import GuideCard from '../components/guides/GuideCard'
import HomeHero from '../components/home/HomeHero'
import ProductSpaceSection from '../components/home/ProductSpaceSection'
import PageContainer from '../components/layout/PageContainer'
import LifePostCard from '../components/life/LifePostCard'

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

function HomeState({ loading, error, empty, children }) {
  if (loading) return <div className="home-state home-state--loading"><span />正在读取社区内容…</div>
  if (error) return <div className="home-state home-state--error">{error}</div>
  if (empty) return <div className="home-state">这里还没有可以展示的内容。</div>
  return children
}

function ChapterPreview({ chapter }) {
  return (
    <Link className="home-chapter-item" to={`/life/chapter/${chapter.slug}`}>
      <span className="home-chapter-item__cover">
        {chapter.cover_thumbnail_url
          ? <AdaptiveMedia src={chapter.cover_thumbnail_url} alt="" />
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
        guidesError: getErrorMessage(guides, '游戏教材暂时无法加载。'),
        postsLoading: false,
        chaptersLoading: false,
        gamesLoading: false,
        guidesLoading: false,
      })
    })

    return () => { cancelled = true }
  }, [])

  return (
    <div className="home-page">
      <HomeHero
        latestPost={home.posts[0]}
        latestGame={home.games[0]}
        loading={home.postsLoading || home.gamesLoading}
      />

      <ProductSpaceSection latestPost={home.posts[0]} latestGame={home.games[0]} />

      <section className="home-domain-section home-domain-section--life" aria-labelledby="home-life-title">
        <PageContainer>
          <HomeSectionHeading
            eyebrow="生活区 · 最近更新"
            title="真实发生的日常，正在这里慢慢积累"
            description="首页只呈现社区中真实发布的内容。照片、时间、章节和作者信息都来自当前系统数据。"
            actionLabel="查看全部生活记录"
            to="/life"
            titleId="home-life-title"
          />

          <div className="home-life-layout">
            <div className="home-life-feed">
              <HomeState loading={home.postsLoading} error={home.postsError} empty={!home.posts.length}>
                <div className="home-life-grid">
                  {home.posts.map((post) => <LifePostCard key={post.id} post={post} />)}
                </div>
              </HomeState>
            </div>

            <aside className="home-chapter-rail" aria-labelledby="home-chapter-title">
              <div className="home-chapter-rail__heading">
                <div>
                  <p className="eyebrow">生活章节</p>
                  <h3 id="home-chapter-title">沿着主题继续浏览</h3>
                </div>
                <Link to="/life/chapters" aria-label="查看全部生活章节">全部</Link>
              </div>
              <HomeState loading={home.chaptersLoading} error={home.chaptersError} empty={!home.chapters.length}>
                <div className="home-chapter-list">
                  {home.chapters.map((chapter) => <ChapterPreview key={chapter.id} chapter={chapter} />)}
                </div>
              </HomeState>
            </aside>
          </div>
        </PageContainer>
      </section>

      <section className="home-domain-section home-domain-section--game" aria-labelledby="home-game-title">
        <PageContainer>
          <HomeSectionHeading
            eyebrow="游戏区 · 目录与教材"
            title="先找到游戏，再进入结构化的实战经验"
            description="游戏、英雄、地图与教材保持清晰关联，让每条经验都能被准确找到和反复使用。"
            actionLabel="进入游戏区"
            to="/games"
            titleId="home-game-title"
          />

          <div className="home-game-layout">
            <div className="home-game-catalog">
              <div className="home-subsection-heading">
                <div>
                  <span>游戏目录</span>
                  <strong>最近维护的游戏</strong>
                </div>
                <Link to="/games">查看目录</Link>
              </div>
              <HomeState loading={home.gamesLoading} error={home.gamesError} empty={!home.games.length}>
                <div className="catalog-grid home-game-grid">
                  {home.games.map((game) => <GameCard key={game.id} game={game} />)}
                </div>
              </HomeState>
            </div>

            <div className="home-guide-panel">
              <div className="home-subsection-heading">
                <div>
                  <span>最新教材</span>
                  <strong>刚刚整理好的经验</strong>
                </div>
                <Link to="/guides">查看全部</Link>
              </div>
              <HomeState loading={home.guidesLoading} error={home.guidesError} empty={!home.guides.length}>
                <div className="home-guide-list">
                  {home.guides.map((guide) => <GuideCard key={guide.id} guide={guide} />)}
                </div>
              </HomeState>
            </div>
          </div>
        </PageContainer>
      </section>

      <section className="home-final-entry">
        <PageContainer>
          <div className="home-final-entry__panel">
            <div>
              <p className="eyebrow">继续探索</p>
              <h2>从真实内容出发，而不是从静态展示开始。</h2>
              <p>浏览社区最新内容，或登录后留下自己的生活记录与游戏经验。</p>
            </div>
            <div className="home-final-entry__actions">
              <Link className="button button--primary" to="/discover">发现内容</Link>
              <Link className="button" to="/publish">发布内容</Link>
            </div>
          </div>
        </PageContainer>
      </section>
    </div>
  )
}
