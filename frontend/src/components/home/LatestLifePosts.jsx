import LifePostCard from '../life/LifePostCard'
import PageContainer from '../layout/PageContainer'
import SectionHeading from '../common/SectionHeading'

export default function LatestLifePosts({ posts, loading, error }) {
  return (
    <section className="content-section content-section--soft" aria-labelledby="latest-life-title">
      <PageContainer>
        <SectionHeading eyebrow="Latest Life" titleId="latest-life-title" title="最近留下的生活片段" description="把普通日子留在这里，也和路过的人分享。" />
        {loading ? <p className="state-message">正在加载日常…</p> : null}
        {error ? <p className="state-message state-message--error">{error}</p> : null}
        {!loading && !error && !posts.length ? <p className="state-message">这里还没有公开日常。</p> : null}
        <div className="card-grid card-grid--three">
          {posts.map((post) => <LifePostCard key={post.id} post={post} />)}
        </div>
      </PageContainer>
    </section>
  )
}
