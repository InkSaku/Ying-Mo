import { Link } from 'react-router-dom'

const principles = [
  {
    index: '01',
    title: '给普通日子留一席之地',
    text: '一顿晚饭、返程车窗、雨后的街，都不必被包装成精彩故事。照片、短句和长文，只需保留它们原来的样子。',
  },
  {
    index: '02',
    title: '让经验回到具体现场',
    text: '每一处点位都落在明确的地图与英雄上。站在哪里、看向哪里、何时出手，说清这些，经验才真正能被另一个人用上。',
  },
  {
    index: '03',
    title: '把声音放轻一些',
    text: '喜欢、收藏与评论都在，但数字不必盖过内容。你可以认真写，也可以安静地看，让每一笔按自己的速度停留。',
  },
]

export default function AboutPage() {
  return (
    <div className="about-page">
      <section className="about-hero page-container" aria-labelledby="about-title">
        <div className="about-hero__copy">
          <p className="eyebrow">关于映墨 · About Yingmo</p>
          <h1 id="about-title">让日常有回声，让经验有去处。</h1>
          <p>
            映墨有两个相邻的房间：一边收着照片、地点与年月，一边收着地图、英雄和实战点位。
            它们节奏不同，却都相信认真留下的东西，会在某一天抵达另一个人。
          </p>
          <div className="about-hero__actions">
            <Link className="button button--primary" to="/life">去日常里坐坐</Link>
            <Link className="button button--outline" to="/games">沿地图找点位</Link>
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
            <h2 id="about-principles-title">愿每一笔，都保留它原来的温度。</h2>
          </div>
          <p>页面会继续生长，下面这些朴素的心意不会改变。</p>
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
              <p className="eyebrow">两个相邻的房间</p>
              <h2 id="about-spaces-title">用不同的方式，收好时间与经验。</h2>
            </div>
          </header>

          <div className="about-space-grid">
            <article className="about-space-card about-space-card--life">
              <span>Life records</span>
              <h3>日常生活区</h3>
              <p>围绕照片、文字、时间、地点与合集，把容易从记忆里滑走的片刻轻轻接住。</p>
              <ul>
                <li>一张照片、几句短话，也容得下长长的叙述</li>
                <li>独自记录，或与别人写进同一本合集</li>
                <li>地点、心情与发生时间，都由你决定是否留下</li>
              </ul>
              <Link to="/life">浏览日常 <span aria-hidden="true">→</span></Link>
            </article>

            <article className="about-space-card about-space-card--game">
              <span>Game knowledge</span>
              <h3>游戏点位区</h3>
              <p>从眼前的地图出发，再找到手中的英雄。点位不讲空泛心得，只留下能够照着走一遍的实战经验。</p>
              <ul>
                <li>地图、英雄与点位始终对应清楚</li>
                <li>用文字、图片或外部视频标明走法</li>
                <li>一起确认旧路标在新版本里是否仍然有效</li>
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
          <h2 id="about-note-title">有些坐标，适合分享；有些只需留给自己。</h2>
          <p>
            日常可以设置可见范围，地点与时间也不必填写。若照片靠近住处、宿舍或其他私人空间，
            写到城市或街区就已经足够。记录属于你，边界也应由你决定。
          </p>
        </div>
        <Link className="button" to="/publish">写下自己的那一笔</Link>
      </section>
    </div>
  )
}
