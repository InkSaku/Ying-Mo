import { NavLink, Outlet } from 'react-router-dom'

const links = [['/admin', '概览'], ['/admin/reports', '举报'], ['/admin/users', '用户'], ['/admin/content', '内容'], ['/admin/chapters', '章节'], ['/admin/catalog', '游戏目录'], ['/admin/logs', '操作日志']]
export default function AdminLayout() { return <section className="admin-layout page-container"><header><p className="eyebrow">治理后台</p><h1>管理映墨社区</h1></header><div className="admin-layout__body"><nav className="admin-layout__nav" aria-label="后台导航">{links.map(([to,label]) => <NavLink end={to === '/admin'} key={to} to={to}>{label}</NavLink>)}</nav><main className="admin-layout__content"><Outlet /></main></div></section> }
