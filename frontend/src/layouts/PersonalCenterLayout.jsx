import { NavLink, Outlet } from 'react-router-dom'

const links = [['/me', '概览'], ['/me/posts', '我的日常'], ['/me/guides', '我的教材'], ['/me/drafts', '草稿'], ['/me/reviewing', '审核中'], ['/me/hidden', '已下架'], ['/me/favorites', '收藏'], ['/me/comments', '评论'], ['/me/settings', '设置']]

export default function PersonalCenterLayout() {
  return <section className="personal-center page-container"><header><p className="eyebrow">个人中心</p><h1>我的映墨</h1></header><div className="personal-center__body"><nav className="personal-center__nav" aria-label="个人中心导航">{links.map(([to, label]) => <NavLink end={to === '/me'} key={to} to={to}>{label}</NavLink>)}</nav><div className="personal-center__content"><Outlet /></div></div></section>
}
