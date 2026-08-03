import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="not-found-page page-container">
      <p className="eyebrow">404</p>
      <h1>这一页，没有留下墨迹</h1>
      <p>也许它换了位置，也许故事还没有写到这里。</p>
      <Link className="button button--primary" to="/">回到有光的地方</Link>
    </section>
  )
}
