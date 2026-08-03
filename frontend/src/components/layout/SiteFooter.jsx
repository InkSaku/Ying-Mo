import { Link } from 'react-router-dom'
import PageContainer from './PageContainer'

export default function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <PageContainer className="footer-main">
        <Link className="brand brand--footer" to="/" aria-label="映墨首页">
          <img className="brand__logo" src="/assets/brand/logo.png" alt="" />
          <span className="brand__copy"><strong>映墨</strong><small>记日常，也记路标</small></span>
        </Link>
        <nav className="footer-nav" aria-label="页脚导航">
          <Link to="/life">日常</Link>
          <Link to="/games">游戏点位</Link>
          <Link to="/about">关于映墨</Link>
        </nav>
      </PageContainer>
      <PageContainer className="footer-bottom">
        <span>© {year} 映墨 Yingmo</span>
        <span>仍在慢慢生长</span>
      </PageContainer>
    </footer>
  )
}
