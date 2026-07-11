import { useEffect, useState } from 'react'

export default function BackToTop() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsVisible(window.scrollY > 480)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!isVisible) return null

  return (
    <button
      className="back-to-top"
      type="button"
      aria-label="返回页面顶部"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      返回顶部
    </button>
  )
}
