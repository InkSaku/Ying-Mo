import { useEffect, useState } from 'react'
import AboutYingmo from '../components/home/AboutYingmo'
import DevelopmentStatus from '../components/home/DevelopmentStatus'
import FeaturedLifeChapters from '../components/home/FeaturedLifeChapters'
import HomeHero from '../components/home/HomeHero'
import { GameCard } from '../components/games/CatalogCards'
import LatestLifePosts from '../components/home/LatestLifePosts'
import ProductSpaceSection from '../components/home/ProductSpaceSection'
import { getLifeChapters, getLifePosts } from '../api/life.js'
import { getGames } from '../api/games.js'
import { getGuides } from '../api/guides.js'
import GuideCard from '../components/guides/GuideCard'
import useHealthStatus from '../hooks/useHealthStatus'

export default function HomePage() {
  const { status, health, error, checkHealth } = useHealthStatus()
  const [life, setLife] = useState({ posts: [], chapters: [], games: [], guides: [], postsError: null, chaptersError: null, gamesError: null, guidesError: null, postsLoading: true, chaptersLoading: true, gamesLoading: true, guidesLoading: true })
  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      getLifePosts({ page: 1, page_size: 3, scope: 'latest' }),
      getLifeChapters({ page: 1, page_size: 4, sort: 'popular' }), getGames({ page: 1, page_size: 4, sort: 'latest' }), getGuides({ page: 1, page_size: 3, sort: 'latest' }),
    ]).then(([posts, chapters, games, guides]) => {
      if (!cancelled) setLife({
        posts: posts.status === 'fulfilled' ? posts.value.data : [],
        chapters: chapters.status === 'fulfilled' ? chapters.value.data : [],
        games: games.status === 'fulfilled' ? games.value.data : [],
        guides: guides.status === 'fulfilled' ? guides.value.data : [],
        postsError: posts.status === 'rejected' ? posts.reason.message : null,
        chaptersError: chapters.status === 'rejected' ? chapters.reason.message : null,
        gamesError: games.status === 'rejected' ? games.reason.message : null,
        guidesError: guides.status === 'rejected' ? guides.reason.message : null,
        postsLoading: false,
        chaptersLoading: false,
        gamesLoading: false,
        guidesLoading: false,
      })
    })
    return () => { cancelled = true }
  }, [])

  return (
    <>
      <HomeHero />
      <ProductSpaceSection />
      <LatestLifePosts posts={life.posts} loading={life.postsLoading} error={life.postsError} />
      <FeaturedLifeChapters chapters={life.chapters} loading={life.chaptersLoading} error={life.chaptersError} />
      <section className="content-section content-section--game"><div className="page-container"><p className="eyebrow">探索游戏</p><h2>游戏目录</h2>{life.gamesLoading && <p className="state-message">正在加载游戏目录…</p>}{life.gamesError && <p className="state-message state-message--error">{life.gamesError}</p>}{!life.gamesLoading && !life.gamesError && !life.games.length && <p className="state-message">游戏目录还没有内容。</p>}{!life.gamesLoading && !life.gamesError && life.games.length > 0 && <div className="catalog-grid">{life.games.map((game) => <GameCard key={game.id} game={game} />)}</div>}</div></section>
      <section className="content-section"><div className="page-container"><p className="eyebrow">最新游戏教材</p><h2>最近分享的实战经验</h2>{life.guidesLoading && <p className="state-message">正在加载教材…</p>}{life.guidesError && <p className="state-message state-message--error">{life.guidesError}</p>}{!life.guidesLoading && !life.guidesError && !life.guides.length && <p className="state-message">这里还没有教材。</p>}{!life.guidesLoading && !life.guidesError && life.guides.length > 0 && <div className="guide-grid">{life.guides.map((guide) => <GuideCard key={guide.id} guide={guide} />)}</div>}</div></section>
      <AboutYingmo />
      <DevelopmentStatus status={status} health={health} error={error} onRetry={checkHealth} />
    </>
  )
}
