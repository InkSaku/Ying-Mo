import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="not-found-page page-container">
      <p className="eyebrow">404</p>
      <h1>页面未找到</h1>
      <p>这个地址暂时不存在。</p>
      <Link className="button button--primary" to="/">返回首页</Link>
    </section>
  )
}
