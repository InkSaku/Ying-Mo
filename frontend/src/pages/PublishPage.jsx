import { Link } from 'react-router-dom'

function LifeVisual() {
  return (
    <svg viewBox="0 0 240 180" aria-hidden="true">
      <rect className="publish-visual__sheet publish-visual__sheet--back" x="62" y="20" width="118" height="140" rx="14" />
      <rect className="publish-visual__sheet publish-visual__sheet--front" x="42" y="34" width="128" height="126" rx="14" />
      <circle className="publish-visual__sun" cx="76" cy="69" r="12" />
      <path className="publish-visual__land" d="M54 132 88 96l24 24 16-18 30 30" />
      <path className="publish-visual__line" d="M76 148h58" />
      <path className="publish-visual__spark" d="m189 50 4 9 9 4-9 4-4 9-4-9-9-4 9-4Z" />
    </svg>
  )
}

function GuideVisual() {
  return (
    <svg viewBox="0 0 240 180" aria-hidden="true">
      <rect className="publish-visual__map" x="38" y="32" width="164" height="116" rx="18" />
      <path className="publish-visual__route" d="M68 118c18-48 40-18 56-54 12-27 35-20 48 2" />
      <circle className="publish-visual__node" cx="68" cy="118" r="10" />
      <circle className="publish-visual__node publish-visual__node--middle" cx="124" cy="64" r="10" />
      <circle className="publish-visual__target" cx="174" cy="68" r="22" />
      <circle className="publish-visual__target-dot" cx="174" cy="68" r="7" />
      <path className="publish-visual__line" d="M75 137h86" />
    </svg>
  )
}

const publishChoices = [
  {
    type: 'life',
    index: '01',
    area: '生活区',
    title: '发布日常',
    description: '从一张照片开始，记录时间、地点、心情和那些值得留下的普通时刻。',
    tags: ['1–9 张照片', '生活章节', '可见范围'],
    action: '开始记录',
    to: '/life/create',
    Visual: LifeVisual,
  },
  {
    type: 'game',
    index: '02',
    area: '游戏区',
    title: '发布游戏教材',
    description: '把游戏、英雄或地图中的实战经验，整理成清楚、可复用的图文步骤。',
    tags: ['1–20 个步骤', '英雄与地图', '版本与难度'],
    action: '开始整理',
    to: '/guide/create',
    Visual: GuideVisual,
  },
]

export default function PublishPage() {
  return (
    <section className="publish-page">
      <div className="publish-page__inner page-container">
        <header className="publish-hero">
          <div className="publish-hero__copy">
            <p className="eyebrow">发布 · 创作入口</p>
            <h1>把今天留下，<br />也把经验讲清楚。</h1>
            <p>
              生活记录和游戏教材拥有不同的表达方式。
              选择一个入口，从一张图片或一个步骤慢慢开始。
            </p>
            <div className="publish-hero__features" aria-label="发布功能">
              <span>支持保存草稿</span>
              <span>图片上传预览</span>
              <span>发布后可编辑</span>
            </div>
          </div>

          <aside className="publish-hero__note">
            <span className="publish-hero__note-mark" aria-hidden="true">墨</span>
            <div>
              <strong>不必一次写得完整</strong>
              <p>真实、清楚，比复杂更重要。先留下最想表达的部分，之后仍可以继续修改。</p>
            </div>
          </aside>
        </header>

        <div className="publish-choice-grid">
          {publishChoices.map(({ type, index, area, title, description, tags, action, to, Visual }) => (
            <article className={`publish-choice publish-choice--${type}`} key={type}>
              <Link to={to} aria-label={`${action}：${title}`}>
                <span className="publish-choice__visual">
                  <Visual />
                  <span className="publish-choice__index">{index}</span>
                </span>

                <span className="publish-choice__body">
                  <span className="publish-choice__area">{area}</span>
                  <strong>{title}</strong>
                  <span className="publish-choice__description">{description}</span>
                  <span className="publish-choice__tags" aria-label={`${title}支持的内容`}>
                    {tags.map((tag) => <span key={tag}>{tag}</span>)}
                  </span>
                </span>

                <span className="publish-choice__footer">
                  <span>{action}</span>
                  <span className="publish-choice__arrow" aria-hidden="true">→</span>
                </span>
              </Link>
            </article>
          ))}
        </div>

        <footer className="publish-footnote">
          <span aria-hidden="true">✦</span>
          <p>上传的图片会先保存在你的创作空间中，正式发布或保存草稿后再与内容绑定。</p>
        </footer>
      </div>
    </section>
  )
}
