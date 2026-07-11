import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageContainer from '../layout/PageContainer'
import SectionHeading from '../common/SectionHeading'

function ChapterCard({ chapter }) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <article className="chapter-card">
      <div className="chapter-card__media">
        {!imageFailed ? <img src={chapter.coverUrl} alt={`${chapter.name}章节封面`} loading="lazy" onError={() => setImageFailed(true)} /> : <span className="image-placeholder">图片暂时无法显示</span>}
      </div>
      <div className="chapter-card__body">
        <p className="eyebrow">{chapter.type}</p>
        <h3>{chapter.name}</h3>
        <p>{chapter.description}</p>
        <p className="chapter-card__stats">{chapter.contentCount} 条片段 · {chapter.contributorCount} 位参与者</p>
        <Link className="text-link" to={`/life?chapter=${chapter.id}`}>查看日常入口</Link>
      </div>
    </article>
  )
}

export default function FeaturedLifeChapters({ chapters }) {
  return (
    <section className="content-section" aria-labelledby="featured-chapters-title">
      <PageContainer>
        <SectionHeading eyebrow="Travel Chapters" titleId="featured-chapters-title" title="热门旅行章节" description="沿着城市和主题，把来自不同朋友的生活片段聚在一起。" />
        <div className="card-grid card-grid--four">
          {chapters.map((chapter) => <ChapterCard key={chapter.id} chapter={chapter} />)}
        </div>
      </PageContainer>
    </section>
  )
}
