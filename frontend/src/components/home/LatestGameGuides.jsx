import { Link } from 'react-router-dom'
import PageContainer from '../layout/PageContainer'
import SectionHeading from '../common/SectionHeading'
import StatusBadge from '../common/StatusBadge'

export default function LatestGameGuides({ guides }) {
  return (
    <section className="content-section content-section--game" aria-labelledby="latest-guides-title">
      <PageContainer>
        <SectionHeading eyebrow="Game Guides" titleId="latest-guides-title" title="最新游戏教材" description="按英雄、地图和技巧类型组织的 Mock 教材预览，不包含未经授权的游戏截图。" />
        <div className="card-grid card-grid--three">
          {guides.map((guide) => (
            <article className="guide-card" key={guide.id}>
              <div className={`guide-card__visual guide-card__visual--${guide.accent}`} aria-hidden="true"><span>{guide.hero.slice(0, 1)}</span><i /><b /></div>
              <div className="guide-card__body">
                <div className="guide-card__topline"><span>{guide.game}</span><StatusBadge tone={guide.validityStatus === '当前有效' ? 'success' : 'warning'}>{guide.validityStatus}</StatusBadge></div>
                <h3>{guide.title}</h3>
                <dl className="guide-card__meta">
                  <div><dt>英雄</dt><dd>{guide.hero}</dd></div>
                  <div><dt>地图</dt><dd>{guide.map}</dd></div>
                  <div><dt>分类</dt><dd>{guide.category}</dd></div>
                  <div><dt>难度</dt><dd>{guide.difficulty}</dd></div>
                </dl>
                <p>{guide.author} · {guide.likes} 喜欢 · {guide.favorites} 收藏</p>
                <Link className="text-link" to="/games">进入教材区</Link>
              </div>
            </article>
          ))}
        </div>
      </PageContainer>
    </section>
  )
}
