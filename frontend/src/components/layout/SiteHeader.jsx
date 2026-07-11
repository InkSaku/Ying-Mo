import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import ThemeToggle from '../common/ThemeToggle'
import PageContainer from './PageContainer'

const navigation = [
  { to: '/', label: '首页', end: true },
  { to: '/life', label: '日常' },
  { to: '/games', label: '游戏教材' },
  { to: '/discover', label: '发现' },
  { to: '/publish', label: '发布' },
  { to: '/about', label: '关于' },
]

export default function SiteHeader({ theme, onThemeToggle }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="site-header">
      <PageContainer className="site-header__inner">
        <NavLink className="brand" to="/" aria-label="映墨首页" onClick={() => setIsMenuOpen(false)}>
          <img className="brand__logo" src="/assets/brand/logo.png" alt="" />
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
        <div className={`header-navigation ${isMenuOpen ? 'is-open' : ''}`} id="primary-navigation">
          <nav className="site-nav" aria-label="主要导航">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `site-nav__link ${isActive ? 'is-active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="site-actions">
            <ThemeToggle theme={theme} onToggle={onThemeToggle} />
            <button className="login-placeholder" type="button" disabled title="登录功能将在认证阶段开放">
              登录
            </button>
          </div>
        </div>
      </PageContainer>
    </header>
  )
}
