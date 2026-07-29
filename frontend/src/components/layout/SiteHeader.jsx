import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { useAuth } from '../../auth/useAuth.js'
import AccountMenu from './AccountMenu.jsx'
import ThemeToggle from '../common/ThemeToggle'
import NotificationBell from '../notifications/NotificationBell.jsx'
import GlobalSearch from '../search/GlobalSearch.jsx'
import PageContainer from './PageContainer'

const navigation = [
  { to: '/', label: '首页', end: true },
  { to: '/life', label: '日常' },
  { to: '/games', label: '游戏点位' },
  { to: '/discover', label: '发现' },
  { to: '/publish', label: '发布' },
]

const ADMIN_ROLES = new Set([
  'content_admin',
  'system_admin',
])

export default function SiteHeader({ theme, onThemeToggle }) {
  const { isAuthenticated, user, logout } = useAuth()
  const headerRef = useRef(null)
  const progressRef = useRef(null)

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const isAdmin = Boolean(
    isAuthenticated
    && user
    && ADMIN_ROLES.has(user.role),
  )

  useEffect(() => {
    let frame = 0

    function updateScrollState() {
      frame = 0
      const scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      const progress = Math.min(1, Math.max(0, window.scrollY / scrollRange))

      headerRef.current?.classList.toggle('is-scrolled', window.scrollY > 12)
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${progress})`
      }
    }

    function scheduleUpdate() {
      if (!frame) frame = window.requestAnimationFrame(updateScrollState)
    }

    updateScrollState()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  function closeMenu() {
    setIsMenuOpen(false)
  }

  async function handleLogout() {
    if (isLoggingOut) return

    setIsLoggingOut(true)

    try {
      await logout()
    } finally {
      setIsLoggingOut(false)
      closeMenu()
    }
  }

  return (
    <header className="site-header" ref={headerRef}>
      <PageContainer className="site-header__inner">
        <NavLink
          className="brand"
          to="/"
          aria-label="映墨首页"
          onClick={closeMenu}
        >
          <img
            className="brand__logo"
            src="/assets/brand/logo.png"
            alt=""
          />

          <span className="brand__copy">
            <strong>映墨</strong>
            <small>把日常映成墨色</small>
          </span>
        </NavLink>

        <button
          className="nav-toggle"
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls="primary-navigation"
          onClick={() => setIsMenuOpen((value) => !value)}
        >
          {isMenuOpen ? '收起导航' : '打开导航'}
        </button>

        <div
          id="primary-navigation"
          className={`header-navigation ${
            isMenuOpen ? 'is-open' : ''
          }`}
        >
          <nav
            className="site-nav"
            aria-label="主要导航"
          >
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (
                  `site-nav__link ${
                    isActive ? 'is-active' : ''
                  }`
                )}
                onClick={closeMenu}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="site-actions">
            <GlobalSearch />

            <ThemeToggle
              theme={theme}
              onToggle={onThemeToggle}
            />

            {isAuthenticated && (
              <NotificationBell />
            )}

            {isAuthenticated ? (
              <AccountMenu
                user={user}
                isAdmin={isAdmin}
                isLoggingOut={isLoggingOut}
                onLogout={handleLogout}
                onNavigate={closeMenu}
              />
            ) : (
              <>
                <Link
                  className="header-auth-link"
                  to="/login"
                  onClick={closeMenu}
                >
                  登录
                </Link>

                <Link
                  className="button button--primary"
                  to="/register"
                  onClick={closeMenu}
                >
                  注册
                </Link>
              </>
            )}
          </div>
        </div>
      </PageContainer>
      <span className="site-header__progress" ref={progressRef} aria-hidden="true" />
    </header>
  )
}
