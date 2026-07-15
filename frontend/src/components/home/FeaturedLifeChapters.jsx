import { Link } from 'react-router-dom'
import AdaptiveMedia from '../common/AdaptiveMedia.jsx'
import PageContainer from '../layout/PageContainer'
import SectionHeading from '../common/SectionHeading'

function ChapterCard({ chapter }) {
  return (
    <article className="chapter-card">
      <div className="chapter-card__media">
        {chapter.cover_thumbnail_url ? <AdaptiveMedia src={chapter.cover_thumbnail_url} alt={`${chapter.name}章节封面`} /> : <span className="image-placeholder">等待一张封面照片</span>}
      </div>
      <div className="chapter-card__body">
        <p className="eyebrow">{chapter.chapter_type}</p>
        <h3>{chapter.name}</h3>
        <p>{chapter.description}</p>
        <p className="chapter-card__stats">{chapter.content_count} 条片段 · {chapter.contributor_count} 位参与者</p>
        <Link className="text-link" to={`/life/chapter/${chapter.slug}`}>查看章节</Link>
      </div>
    </article>
  )
}

export default function FeaturedLifeChapters({ chapters, loading, error }) {
  return (
    <section className="content-section" aria-labelledby="featured-chapters-title">
      <PageContainer>
        <SectionHeading eyebrow="Travel Chapters" titleId="featured-chapters-title" title="热门旅行章节" description="沿着城市和主题，把来自不同朋友的生活片段聚在一起。" />
        {loading ? <p className="state-message">正在加载章节…</p> : null}
        {error ? <p className="state-message state-message--error">{error}</p> : null}
        {!loading && !error && !chapters.length ? <p className="state-message">这里还没有可展示的生活章节。</p> : null}
        <div className="card-grid card-grid--four">
          {chapters.map((chapter) => <ChapterCard key={chapter.id} chapter={chapter} />)}
        </div>
      </PageContainer>
    </section>
  )
}
