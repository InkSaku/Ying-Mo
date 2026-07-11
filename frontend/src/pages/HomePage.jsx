import { useCallback, useRef, useState } from 'react'
import AboutYingmo from '../components/home/AboutYingmo'
import DevelopmentStatus from '../components/home/DevelopmentStatus'
import FeaturedLifeChapters from '../components/home/FeaturedLifeChapters'
import HomeHero from '../components/home/HomeHero'
import LatestGameGuides from '../components/home/LatestGameGuides'
import LatestLifePosts from '../components/home/LatestLifePosts'
import ProductSpaceSection from '../components/home/ProductSpaceSection'
import LifePostLightbox from '../components/life/LifePostLightbox'
import useHealthStatus from '../hooks/useHealthStatus'
import { gameGuides } from '../mocks/gameGuides'
import { lifeChapters } from '../mocks/lifeChapters'
import { lifePosts } from '../mocks/lifePosts'

export default function HomePage() {
  const { status, health, error, checkHealth } = useHealthStatus()
  const [selectedPost, setSelectedPost] = useState(null)
  const triggerRef = useRef(null)

  const openPost = useCallback((post, trigger) => {
    triggerRef.current = trigger
    setSelectedPost(post)
  }, [])

  const closePost = useCallback(() => {
    setSelectedPost(null)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  return (
    <>
      <HomeHero />
      <ProductSpaceSection />
      <LatestLifePosts posts={lifePosts} onOpenPost={openPost} />
      <FeaturedLifeChapters chapters={lifeChapters} />
      <LatestGameGuides guides={gameGuides} />
      <AboutYingmo />
      <DevelopmentStatus status={status} health={health} error={error} onRetry={checkHealth} />
      {selectedPost ? <LifePostLightbox post={selectedPost} onClose={closePost} /> : null}
    </>
  )
}
