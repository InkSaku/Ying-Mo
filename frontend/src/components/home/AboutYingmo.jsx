import PageContainer from '../layout/PageContainer'

export default function AboutYingmo() {
  return (
    <section className="content-section" aria-labelledby="about-yingmo-title">
      <PageContainer>
        <article className="about-card">
          <div className="about-card__mark"><img src="/assets/brand/logo.png" alt="" /></div>
          <div>
            <p className="eyebrow">About Yingmo</p>
            <h2 id="about-yingmo-title">一个记录生活，也认真分享知识的小社区</h2>
            <p>映墨包含日常生活和游戏教材两个空间。这里不追逐流量和热榜，更希望让真实影像被慢慢保存，让有用经验可以被共同补充。</p>
            <p>项目仍处于开发阶段。现在看到的日常、章节和教材均为迁移期 Mock 内容。</p>
          </div>
        </article>
      </PageContainer>
    </section>
  )
}
