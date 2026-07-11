import { Link } from 'react-router-dom'
import PageContainer from '../layout/PageContainer'

export default function HomeHero() {
  return (
    <section className="home-hero">
      <PageContainer className="home-hero__inner">
        <div className="hero-copy">
          <p className="eyebrow">生活影像与游戏知识的小型社区</p>
          <h1>把日常映成墨色</h1>
          <p className="hero-copy__lead">记录旅行、照片和普通生活，也分享游戏英雄、地图与点位经验。</p>
          <div className="hero-actions">
            <Link className="button button--primary" to="/life">记录生活</Link>
            <Link className="button button--outline" to="/games">学习游戏</Link>
          </div>
          <div className="hero-stats" aria-label="映墨当前状态">
            <span>双内容空间</span>
            <span>真实记录</span>
            <span>共同维护知识</span>
          </div>
        </div>
        <div className="hero-visual" aria-label="映墨生活影像预览">
          <article className="snapshot-card">
            <img src="/assets/gallery/photo-01.jpg" alt="映墨中的一张傍晚生活照片" />
            <div><strong>普通日子，也值得保存</strong><span>一张照片，一点心情。</span></div>
          </article>
          <div className="hero-orbit hero-orbit--life">日常</div>
          <div className="hero-orbit hero-orbit--game">教材</div>
        </div>
      </PageContainer>
    </section>
  )
}
