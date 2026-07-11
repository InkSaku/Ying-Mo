import { Link, useLocation } from 'react-router-dom'

const pageCopy = {
  '/life': ['日常生活区', '阶段 4 将实现章节、发布、列表与详情。'],
  '/games': ['游戏教材区', '阶段 6 与阶段 7 将实现游戏目录和结构化教材。'],
  '/discover': ['发现', '搜索与发现能力将在基础内容闭环之后实现。'],
  '/publish': ['发布', '真实发布依赖认证、上传与内容 API，目前尚未开放。'],
  '/about': ['关于映墨', '更完整的产品说明将在后续内容页面中完善。'],
}

export default function ComingSoonPage() {
  const location = useLocation()
  const [title, description] = pageCopy[location.pathname] ?? ['功能正在开发中', '这个页面尚未开放。']

  return (
    <section className="placeholder-page page-container">
      <p className="eyebrow">Coming Soon</p>
      <h1>{title}</h1>
      <p>{description}</p>
      <p>这里只建立导航结构，不代表业务功能已经完成。</p>
      <Link className="button button--primary" to="/">返回首页</Link>
    </section>
  )
}
