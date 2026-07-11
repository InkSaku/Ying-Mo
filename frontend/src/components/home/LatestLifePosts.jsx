import LifePostCard from '../life/LifePostCard'
import PageContainer from '../layout/PageContainer'
import SectionHeading from '../common/SectionHeading'

export default function LatestLifePosts({ posts, onOpenPost }) {
  return (
    <section className="content-section content-section--soft" aria-labelledby="latest-life-title">
      <PageContainer>
        <SectionHeading eyebrow="Latest Life" titleId="latest-life-title" title="最近留下的生活片段" description="这些内容是首页迁移阶段的 Mock 展示数据，不代表真实用户发布。" />
        <div className="card-grid card-grid--three">
          {posts.map((post) => <LifePostCard key={post.id} post={post} onOpen={onOpenPost} />)}
        </div>
      </PageContainer>
    </section>
  )
}
