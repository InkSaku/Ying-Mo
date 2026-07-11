import { Outlet } from 'react-router-dom'
import SiteFooter from '../components/layout/SiteFooter'
import SiteHeader from '../components/layout/SiteHeader'
import BackToTop from '../components/layout/BackToTop'
import useTheme from '../hooks/useTheme'

export default function BaseLayout() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="app-shell">
      <SiteHeader theme={theme} onThemeToggle={toggleTheme} />
      <main className="app-main">
        <Outlet />
      </main>
      <SiteFooter />
      <BackToTop />
    </div>
  )
}
