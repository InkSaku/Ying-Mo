import { useEffect, useState } from 'react'
import AboutYingmo from '../components/home/AboutYingmo'
import DevelopmentStatus from '../components/home/DevelopmentStatus'
import FeaturedLifeChapters from '../components/home/FeaturedLifeChapters'
import HomeHero from '../components/home/HomeHero'
import LatestGameGuides from '../components/home/LatestGameGuides'
import LatestLifePosts from '../components/home/LatestLifePosts'
import ProductSpaceSection from '../components/home/ProductSpaceSection'
import { getLifeChapters, getLifePosts } from '../api/life.js'
import useHealthStatus from '../hooks/useHealthStatus'
import { gameGuides } from '../mocks/gameGuides'

export default function HomePage() {
  const { status, health, error, checkHealth } = useHealthStatus()
  const [life, setLife] = useState({ posts: [], chapters: [], postsError: null, chaptersError: null })
  useEffect(() => { let cancelled = false; Promise.allSettled([getLifePosts({ page: 1, page_size: 3, scope: 'latest' }), getLifeChapters({ page: 1, page_size: 4, sort: 'popular' })]).then(([posts, chapters]) => { if (!cancelled) setLife({ posts: posts.status === 'fulfilled' ? posts.value.data : [], chapters: chapters.status === 'fulfilled' ? chapters.value.data : [], postsError: posts.status === 'rejected' ? posts.reason.message : null, chaptersError: chapters.status === 'rejected' ? chapters.reason.message : null }) }); return () => { cancelled = true } }, [])

  return (
    <>
      <HomeHero />
      <ProductSpaceSection />
      <LatestLifePosts posts={life.posts} error={life.postsError} />
      <FeaturedLifeChapters chapters={life.chapters} error={life.chaptersError} />
      <LatestGameGuides guides={gameGuides} />
      <AboutYingmo />
      <DevelopmentStatus status={status} health={health} error={error} onRetry={checkHealth} />
    </>
  )
}
