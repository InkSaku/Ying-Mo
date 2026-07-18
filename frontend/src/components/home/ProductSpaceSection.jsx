import { Link } from 'react-router-dom'
import AdaptiveMedia from '../common/AdaptiveMedia.jsx'
import PageContainer from '../layout/PageContainer'
import Reveal from '../motion/Reveal.jsx'
import { cappedStagger } from '../../lib/motion.js'

function ModuleMedia({ source, alt, fallback }) {
  return (
    <span className="home-module-card__media">
      {source ? <AdaptiveMedia src={source} alt={alt} /> : <span aria-hidden="true">{fallback}</span>}
    </span>
  )
}

export default function ProductSpaceSection({ latestPost, latestGame }) {
  const gameCover = latestGame?.cover_thumbnail_url || latestGame?.icon_thumbnail_url

  return (
    <section className="home-module-section" id="home-spaces" aria-labelledby="home-spaces-title">
      <PageContainer>
        <Reveal className="home-module-section__heading">
          <p className="eyebrow">两个独立内容空间</p>
          <h2 id="home-spaces-title">选择你此刻想进入的地方</h2>
          <p>生活区关注照片、时间与情绪；游戏区关注目录、对象关系与可复用经验。两者共享用户和互动能力，但不混淆内容结构。</p>
        </Reveal>

        <div className="home-module-grid">
          <Reveal className="home-motion-card" delay={cappedStagger(0)}>
            <article className="home-module-card home-module-card--life">
            <Link to="/life">
              <div className="home-module-card__topline"><span>01</span><strong>生活区</strong></div>
              <div className="home-module-card__content">
                <div>
                  <p className="eyebrow">Life records</p>
                  <h3>让照片回到真实的时间和章节中</h3>
                  <p>浏览生活动态、城市与主题章节，也可以发布自己的照片记录。</p>
                </div>
                <ModuleMedia source={latestPost?.cover_image} alt="最新生活记录预览" fallback="生" />
              </div>
              <div className="home-module-card__footer">
                <span>生活动态</span><span>照片记录</span><span>主题章节</span><b aria-hidden="true">→</b>
              </div>
            </Link>
            </article>
          </Reveal>

          <Reveal className="home-motion-card" delay={cappedStagger(1)}>
            <article className="home-module-card home-module-card--game">
            <Link to="/games">
              <div className="home-module-card__topline"><span>02</span><strong>游戏区</strong></div>
              <div className="home-module-card__content">
                <div>
                  <p className="eyebrow">Game knowledge</p>
                  <h3>从游戏目录进入英雄、地图与实战教材</h3>
                  <p>按照明确的对象关系组织经验，降低查找成本，也方便持续维护。</p>
                </div>
                <ModuleMedia source={gameCover} alt="最新游戏目录预览" fallback="游" />
              </div>
              <div className="home-module-card__footer">
                <span>游戏目录</span><span>英雄地图</span><span>步骤教材</span><b aria-hidden="true">→</b>
              </div>
            </Link>
            </article>
          </Reveal>
        </div>
      </PageContainer>
    </section>
  )
}
