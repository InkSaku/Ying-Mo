import { useLocation } from 'react-router-dom'

import SiteFooter from '../components/layout/SiteFooter'
import SiteHeader from '../components/layout/SiteHeader'
import BackToTop from '../components/layout/BackToTop'
import ImmersiveShell from '../components/motion/ImmersiveShell.jsx'
import PageTransition from '../components/motion/PageTransition.jsx'
import useTheme from '../hooks/useTheme'

export default function BaseLayout() {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const isAdminWorkspace = location.pathname === '/admin' || location.pathname.startsWith('/admin/')

  return (
    <ImmersiveShell className={isAdminWorkspace ? 'app-shell--admin' : undefined}>
      {!isAdminWorkspace && <SiteHeader theme={theme} onThemeToggle={toggleTheme} />}
      <main className={`app-main${isAdminWorkspace ? ' app-main--admin' : ''}`}>
        <PageTransition />
      </main>
      {!isAdminWorkspace && <SiteFooter />}
      {!isAdminWorkspace && <BackToTop />}
    </ImmersiveShell>
  )
}
