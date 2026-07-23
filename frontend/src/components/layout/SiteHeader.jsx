import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

import { useAuth } from '../../auth/useAuth.js'
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
  { to: '/about', label: '关于' },
]

const ADMIN_ROLES = new Set([
  'content_admin',
  'system_admin',
])

export default function SiteHeader({ theme, onThemeToggle }) {
  const { isAuthenticated, user, logout } = useAuth()

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const isAdmin = Boolean(
    isAuthenticated
    && user
    && ADMIN_ROLES.has(user.role),
  )

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
    <header className="site-header">
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
              <>
                <Link
                  className="header-profile"
                  to={`/user/${encodeURIComponent(
                    user.username,
                  )}`}
                  onClick={closeMenu}
                >
                  {user.avatar_url ? (
                    <img
                      className="header-profile__avatar"
                      src={user.avatar_url}
                      alt=""
                    />
                  ) : (
                    <span
                      className="header-profile__avatar"
                      aria-hidden="true"
                    >
                      {(user.nickname || user.username)
                        .slice(0, 1)}
                    </span>
                  )}

                  <span className="header-profile__name">
                    {user.nickname || user.username}
                  </span>
                </Link>

                <Link
                  className="header-settings-link"
                  to="/me"
                  onClick={closeMenu}
                >
                  个人中心
                </Link>

                {isAdmin && (
                  <Link
                    className="header-settings-link"
                    to="/admin"
                    onClick={closeMenu}
                  >
                    管理后台
                  </Link>
                )}

                <button
                  className="header-logout"
                  type="button"
                  disabled={isLoggingOut}
                  onClick={() => void handleLogout()}
                >
                  {isLoggingOut
                    ? '退出中…'
                    : '退出'}
                </button>
              </>
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
    </header>
  )
}
