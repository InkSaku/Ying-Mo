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
    area: '写给生活',
    title: '留下一段日常',
    description: '一张照片、一句当时的话，或一篇写得很慢的长文。',
    tags: ['照片与文字', '生活合集', '长短皆可'],
    prompt: '从一张照片开始',
    action: '写下此刻',
    to: '/life/create',
    Visual: LifeVisual,
  },
  {
    type: 'game',
    index: '02',
    area: '写给同行者',
    title: '留下一处点位',
    description: '把站位、朝向、操作和时机说清，让下一位玩家也能顺利复现。',
    tags: ['地图与英雄', '图片或视频', '实战验证'],
    prompt: '从一个位置开始',
    action: '留下路标',
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
            <p className="eyebrow">落笔 · 从这里开始</p>
            <h1>今天，想留下什么？</h1>
            <p>
              可以是一段值得收好的日常，也可以是一处想留给后来人的坐标。
              不必准备周全，先写下最重要的那一笔。
            </p>
          </div>

          <aside className="publish-hero__note">
            <span className="publish-hero__note-mark" aria-hidden="true">✦</span>
            <div>
              <strong>慢一点，也没关系</strong>
              <p>两种内容都可以先存为草稿，发布以后也能继续添改。</p>
            </div>
          </aside>
        </header>

        <section className="publish-paths" aria-labelledby="publish-paths-title">
          <div className="publish-paths__heading">
            <div>
              <span className="publish-paths__line" aria-hidden="true" />
              <p>两种写法</p>
            </div>
            <h2 id="publish-paths-title">选择一处，开始落笔</h2>
          </div>

          <div className="publish-choice-grid">
            {publishChoices.map(({
              type, index, area, title, description, tags, prompt, action, to, Visual,
            }) => (
              <article className={`publish-choice publish-choice--${type}`} key={type}>
                <Link to={to} aria-label={`${action}：${title}`}>
                  <span className="publish-choice__content">
                    <span className="publish-choice__meta">
                      <span className="publish-choice__index">{index}</span>
                      <span className="publish-choice__area">{area}</span>
                    </span>

                    <span className="publish-choice__body">
                      <strong>{title}</strong>
                      <span className="publish-choice__description">{description}</span>
                      <span className="publish-choice__tags" aria-label={`${title}支持的内容`}>
                        {tags.map((tag) => <span key={tag}>{tag}</span>)}
                      </span>
                    </span>

                    <span className="publish-choice__footer">
                      <span>
                        <small>{prompt}</small>
                        <strong>{action}</strong>
                      </span>
                      <span className="publish-choice__arrow" aria-hidden="true">↗</span>
                    </span>
                  </span>

                  <span className="publish-choice__visual">
                    <Visual />
                    <span className="publish-choice__visual-label" aria-hidden="true">
                      {type === 'life' ? 'MEMORY' : 'COORDINATE'}
                    </span>
                  </span>
                </Link>
              </article>
            ))}
          </div>
        </section>

        <footer className="publish-footnote">
          <span aria-hidden="true">◌</span>
          <p>图片只会在发布或保存草稿后，和这段内容一起留下。</p>
        </footer>
      </div>
    </section>
  )
}
