import { Link } from 'react-router-dom'

const principles = [
  {
    index: '01',
    title: '真实，而不是完美',
    text: '日常区欢迎普通照片、短句、长文和共同记忆。记录不需要被包装成精彩故事，也不强制填写地点、心情或拍摄时间。',
  },
  {
    index: '02',
    title: '有用，而不是热闹',
    text: '游戏区按照游戏、地图、英雄和点位组织经验，让正在对局中的玩家可以更快找到能够复现的实用内容。',
  },
  {
    index: '03',
    title: '克制，而不是打扰',
    text: '映墨保留喜欢、收藏、评论和通知，但不会让互动数字盖过内容本身。这里更适合慢慢记录，也适合安静浏览。',
  },
]

export default function AboutPage() {
  return (
    <div className="about-page">
      <section className="about-hero page-container" aria-labelledby="about-title">
        <div className="about-hero__copy">
          <p className="eyebrow">关于映墨 · About Yingmo</p>
          <h1 id="about-title">把普通日子和有用经验，认真留在这里。</h1>
          <p>
            映墨是一个同时承载生活记录与游戏实用知识的轻量社区。
            两个空间共享用户与互动能力，但尊重各自不同的内容节奏。
          </p>
          <div className="about-hero__actions">
            <Link className="button button--primary" to="/life">看看真实日常</Link>
            <Link className="button button--outline" to="/games">进入游戏点位</Link>
          </div>
        </div>

        <div className="about-hero__mark" aria-hidden="true">
          <span className="about-hero__orbit about-hero__orbit--life">生活</span>
          <span className="about-hero__orbit about-hero__orbit--game">经验</span>
          <div>
            <img src="/assets/brand/logo.png" alt="" />
            <strong>映墨</strong>
            <small>YINGMO COMMUNITY</small>
          </div>
        </div>
      </section>

      <section className="about-section page-container" aria-labelledby="about-principles-title">
        <header className="about-section__heading">
          <div>
            <p className="eyebrow">我们在意的事情</p>
            <h2 id="about-principles-title">内容先于流量，表达不必有压力。</h2>
          </div>
          <p>映墨仍在持续开发，但这些原则不会因为功能增加而改变。</p>
        </header>

        <div className="about-principles">
          {principles.map((item) => (
            <article key={item.index}>
              <span>{item.index}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-spaces" aria-labelledby="about-spaces-title">
        <div className="page-container">
          <header className="about-section__heading">
            <div>
              <p className="eyebrow">两个内容空间</p>
              <h2 id="about-spaces-title">不同的内容，使用不同的组织方式。</h2>
            </div>
          </header>

          <div className="about-space-grid">
            <article className="about-space-card about-space-card--life">
              <span>Life records</span>
              <h3>日常生活区</h3>
              <p>围绕照片、文字、时间、地点和主题合集，保存那些容易被忽略的普通瞬间。</p>
              <ul>
                <li>短句、图文与 Markdown 长文</li>
                <li>个人合集与多人共同记录</li>
                <li>地点、心情和发生时间均可选</li>
              </ul>
              <Link to="/life">浏览日常 <span aria-hidden="true">→</span></Link>
            </article>

            <article className="about-space-card about-space-card--game">
              <span>Game knowledge</span>
              <h3>游戏点位区</h3>
              <p>以地图为主要入口，再选择英雄和点位教程，让经验可以被快速找到和反复验证。</p>
              <ul>
                <li>游戏、地图、英雄关系清晰</li>
                <li>文字、图片与外部视频说明</li>
                <li>支持版本有效性反馈</li>
              </ul>
              <Link to="/games">查找点位 <span aria-hidden="true">→</span></Link>
            </article>
          </div>
        </div>
      </section>

      <section className="about-note page-container" aria-labelledby="about-note-title">
        <div className="about-note__mark" aria-hidden="true">隐私</div>
        <div>
          <p className="eyebrow">记录属于你</p>
          <h2 id="about-note-title">是否公开、公开到什么程度，应当由记录者决定。</h2>
          <p>
            日记可以设置可见范围，地点和时间也是可选信息。映墨不会要求每一条记录都暴露精确位置；
            在分享私人住宅、学校宿舍或其他敏感地点时，也建议优先使用模糊地点。
          </p>
        </div>
        <Link className="button" to="/publish">留下自己的记录</Link>
      </section>
    </div>
  )
}
