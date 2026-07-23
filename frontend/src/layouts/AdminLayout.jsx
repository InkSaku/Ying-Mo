/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../auth/useAuth.js'

const primaryLinks = [
  { to: '/admin', label: '概览', description: '社区运行情况', icon: 'overview', end: true },
  { to: '/admin/reports', label: '举报处理', description: '处理社区反馈', icon: 'report' },
]

const contentLinks = [
  { to: '/admin/users', label: '用户', description: '权限与账号状态', icon: 'users' },
  { to: '/admin/content', label: '内容', description: '日常、教材与评论', icon: 'content' },
]

const catalogLinks = [
  { to: '/admin/chapters', label: '生活章节', description: '生活章节维护', icon: 'chapter' },
  { to: '/admin/catalog', label: '游戏目录', description: '游戏、英雄与地图', icon: 'catalog' },
]

const systemLinks = [
  { to: '/admin/logs', label: '操作日志', description: '高风险操作记录', icon: 'logs' },
]

function AdminIcon({ name }) {
  const paths = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    report: <><path d="M5 21V4" /><path d="M5 5h10l-1.5 3L15 11H5" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    content: <><path d="M6 2h9l4 4v16H6z" /><path d="M14 2v5h5" /><path d="M9 13h6" /><path d="M9 17h6" /></>,
    chapter: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" /><path d="M8 7h8" /><path d="M8 11h6" /></>,
    catalog: <><path d="M8 6h8" /><path d="M7 10h10a5 5 0 0 1 4.72 6.65l-.48 1.38a2.8 2.8 0 0 1-4.65 1.08L14.5 17h-5l-2.09 2.11a2.8 2.8 0 0 1-4.65-1.08l-.48-1.38A5 5 0 0 1 7 10z" /><path d="M7 14h3" /><path d="M8.5 12.5v3" /><circle cx="16.5" cy="13.5" r=".75" fill="currentColor" stroke="none" /><circle cx="18.5" cy="15.5" r=".75" fill="currentColor" stroke="none" /></>,
    logs: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
    close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  }

  return (
    <svg className="admin-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7">
      {paths[name]}
    </svg>
  )
}

function NavigationGroup({ label, links }) {
  return (
    <section className="admin-nav-group">
      <p className="admin-nav-group__label">{label}</p>
      <div className="admin-nav-group__links">
        {links.map((link) => (
          <NavLink
            aria-label={`${link.label}：${link.description}`}
            className={({ isActive }) => `admin-nav-item ${isActive ? 'is-active' : ''}`}
            end={link.end}
            key={link.to}
            title={link.description}
            to={link.to}
          >
            <span className="admin-nav-item__icon"><AdminIcon name={link.icon} /></span>
            <span className="admin-nav-item__text"><strong>{link.label}</strong></span>
          </NavLink>
        ))}
      </div>
    </section>
  )
}

export default function AdminLayout() {
  const { user } = useAuth()
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const roleLabel = user?.role === 'system_admin' ? '系统管理员' : '内容管理员'
  const displayName = user?.nickname || user?.username || '管理员'
  const displayInitial = displayName.trim().slice(0, 1) || '映'

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  return (
    <section className={`admin-layout page-container ${navOpen ? 'is-nav-open' : ''}`}>
      <header className="admin-layout__toolbar">
        <button
          aria-controls="admin-sidebar"
          aria-expanded={navOpen}
          aria-label="打开后台导航"
          className="admin-layout__menu"
          onClick={() => setNavOpen(true)}
          type="button"
        >
          <AdminIcon name="menu" />
        </button>

        <div className="admin-layout__brand" aria-label="映墨治理后台">
          <span className="admin-layout__brand-mark" aria-hidden="true">映</span>
          <span className="admin-layout__brand-copy">
            <small>映墨</small>
            <strong>治理后台</strong>
          </span>
        </div>

        <div className="admin-layout__toolbar-actions">
          <span className="admin-layout__role">{roleLabel}</span>
          <Link className="admin-layout__back" to="/">
            <span>返回站点</span>
            <AdminIcon name="arrow" />
          </Link>
        </div>
      </header>

      <div className="admin-layout__body">
        <button
          aria-label="关闭后台导航"
          className="admin-sidebar__overlay"
          onClick={() => setNavOpen(false)}
          type="button"
        />

        <aside className="admin-sidebar" id="admin-sidebar">
          <div className="admin-sidebar__mobile-header">
            <strong>后台导航</strong>
            <button aria-label="关闭后台导航" onClick={() => setNavOpen(false)} type="button">
              <AdminIcon name="close" />
            </button>
          </div>

          <nav className="admin-layout__nav" aria-label="后台导航">
            <NavigationGroup label="工作台" links={primaryLinks} />
            <NavigationGroup label="内容治理" links={contentLinks} />
            <NavigationGroup label="目录维护" links={catalogLinks} />
            {user?.role === 'system_admin' && <NavigationGroup label="系统" links={systemLinks} />}
          </nav>

          <div className="admin-sidebar__footer">
            <span className="admin-sidebar__avatar" aria-hidden="true">{displayInitial}</span>
            <span className="admin-sidebar__identity-copy">
              <strong>{displayName}</strong>
              <small>{roleLabel}</small>
            </span>
          </div>
        </aside>

        <main className="admin-layout__content">
          <Outlet />
        </main>
      </div>
    </section>
  )
}
