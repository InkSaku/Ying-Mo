import { Link } from 'react-router-dom'
import AdaptiveMedia from '../common/AdaptiveMedia.jsx'
import PageContainer from '../layout/PageContainer'
import Reveal from '../motion/Reveal.jsx'
import { cappedStagger } from '../../lib/motion.js'

function ModuleMedia({ source, alt, fallback, width, height, live = false }) {
  return (
    <span className="home-module-card__media">
      {source ? <AdaptiveMedia src={source} alt={alt} fit="contain" width={width} height={height} /> : <span aria-hidden="true">{fallback}</span>}
      {live && <span className="live-photo-badge">实况</span>}
    </span>
  )
}

export default function ProductSpaceSection({ latestPost, latestGame }) {
  const gameCover = latestGame?.cover_thumbnail_url || latestGame?.icon_thumbnail_url

  return (
    <section className="home-module-section" id="home-spaces" aria-labelledby="home-spaces-title">
      <PageContainer>
        <Reveal className="home-module-section__heading">
          <p className="eyebrow">两个相邻的空间</p>
          <h2 id="home-spaces-title">从此刻的心绪，或下一局的地图出发</h2>
          <p>一边收留照片和文字，一边收好站位、路线与时机。它们各有自己的秩序，也都由真实的人一点点写成。</p>
        </Reveal>

        <div className="home-module-grid">
          <Reveal className="home-motion-card" delay={cappedStagger(0)}>
            <article className="home-module-card home-module-card--life">
            <Link to="/life">
              <div className="home-module-card__topline"><span>01</span><strong>生活区</strong></div>
              <div className="home-module-card__content">
                <div>
                  <p className="eyebrow">Life records</p>
                  <h3>把照片安放回那一天</h3>
                  <p>沿着城市、旅途和共同主题翻看生活，也写下属于自己的片刻。</p>
                </div>
                <ModuleMedia source={latestPost?.cover_image} alt="最新生活记录预览" fallback="生" width={latestPost?.cover_width} height={latestPost?.cover_height} live={latestPost?.cover_media_type === 'live_video'} />
              </div>
              <div className="home-module-card__footer">
                <span>照片</span><span>时光</span><span>共同记忆</span><b aria-hidden="true">→</b>
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
                  <h3>地图已定，就从英雄开始</h3>
                  <p>按地图寻找英雄点位，把站位、朝向和时机留给下一次实战。</p>
                </div>
                <ModuleMedia source={gameCover} alt="最新游戏目录预览" fallback="游" />
              </div>
              <div className="home-module-card__footer">
                <span>地图</span><span>英雄</span><span>实战路标</span><b aria-hidden="true">→</b>
              </div>
            </Link>
            </article>
          </Reveal>
        </div>
      </PageContainer>
    </section>
  )
}
