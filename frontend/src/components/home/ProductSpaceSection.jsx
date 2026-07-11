import { Link } from 'react-router-dom'
import PageContainer from '../layout/PageContainer'
import SectionHeading from '../common/SectionHeading'

export default function ProductSpaceSection() {
  return (
    <section className="content-section" aria-labelledby="product-spaces-title">
      <PageContainer>
        <SectionHeading
          eyebrow="Two Spaces"
          titleId="product-spaces-title"
          title="从生活片段，到实战经验"
          description="两个空间共享映墨的用户与互动能力，却保留各自最合适的内容结构。"
        />
        <div className="product-spaces">
          <article className="space-card space-card--life">
            <div className="space-card__visual">
              <img src="/assets/gallery/photo-02.jpg" alt="城市旅行中的生活照片" loading="lazy" />
            </div>
            <div className="space-card__body">
              <p className="eyebrow">日常生活区</p>
              <h3>用照片记录城市和普通日子</h3>
              <p>在青岛、北京、杭州等章节中，和朋友共同留下旅行与生活片段。</p>
              <div className="tag-row"><span>城市</span><span>旅行</span><span>照片</span></div>
              <Link className="text-link" to="/life">进入日常生活区</Link>
            </div>
          </article>
          <article className="space-card space-card--game">
            <div className="game-abstract" aria-hidden="true"><span>G</span><i /><b /></div>
            <div className="space-card__body">
              <p className="eyebrow">游戏教材区</p>
              <h3>按游戏、英雄和地图组织实战知识</h3>
              <p>分享炮台点位、雷管技巧、投掷落点和更多可以反复学习的玩家经验。</p>
              <div className="tag-row"><span>英雄</span><span>地图</span><span>点位</span></div>
              <Link className="text-link" to="/games">进入游戏教材区</Link>
            </div>
          </article>
        </div>
      </PageContainer>
    </section>
  )
}
