import { Link, NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../auth/useAuth.js'

const primaryLinks = [
  { to: '/admin', label: '概览', description: '社区运行情况', end: true },
  { to: '/admin/reports', label: '举报', description: '处理社区反馈' },
]

const contentLinks = [
  { to: '/admin/users', label: '用户', description: '权限与账号状态' },
  { to: '/admin/content', label: '内容', description: '日常、教材与评论' },
  { to: '/admin/chapters', label: '章节', description: '生活章节维护' },
  { to: '/admin/catalog', label: '游戏目录', description: '游戏、英雄与地图' },
]

const systemLinks = [
  { to: '/admin/logs', label: '操作日志', description: '高风险操作记录' },
]

function NavigationGroup({ label, links }) {
  return (
    <section className="admin-nav-group">
      <p className="admin-nav-group__label">{label}</p>
      <div className="admin-nav-group__links">
        {links.map((link) => (
          <NavLink
            className={({ isActive }) => `admin-nav-item ${isActive ? 'is-active' : ''}`}
            end={link.end}
            key={link.to}
            to={link.to}
          >
            <span className="admin-nav-item__text">
              <strong>{link.label}</strong>
              <small>{link.description}</small>
            </span>
          </NavLink>
        ))}
      </div>
    </section>
  )
}

export default function AdminLayout() {
  const { user } = useAuth()
  const roleLabel = user?.role === 'system_admin' ? '系统管理员' : '内容管理员'

  return (
    <section className="admin-layout page-container">
      <header className="admin-layout__header">
        <div>
          <p className="eyebrow">治理后台</p>
          <h1>管理映墨社区</h1>
          <p className="admin-layout__intro">
            处理内容、用户与社区反馈，让这里保持安静、友善和有序。
          </p>
        </div>
        <Link className="admin-layout__back" to="/">返回映墨</Link>
      </header>

      <div className="admin-layout__body">
        <aside className="admin-sidebar">
          <div className="admin-sidebar__identity">
            <span className="admin-sidebar__mark" aria-hidden="true">映</span>
            <div>
              <strong>映墨治理台</strong>
              <span>当前身份：{roleLabel}</span>
            </div>
          </div>

          <nav className="admin-layout__nav" aria-label="后台导航">
            <NavigationGroup label="工作台" links={primaryLinks} />
            <NavigationGroup label="社区治理" links={contentLinks} />
            {user?.role === 'system_admin' && <NavigationGroup label="系统" links={systemLinks} />}
          </nav>

          <div className="admin-sidebar__footer">
            <span className="admin-sidebar__status-dot" aria-hidden="true" />
            <span>管理服务已连接</span>
          </div>
        </aside>

        <main className="admin-layout__content">
          <Outlet />
        </main>
      </div>
    </section>
  )
}
