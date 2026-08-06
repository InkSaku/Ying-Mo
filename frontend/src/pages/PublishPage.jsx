import { Link } from 'react-router-dom'

export default function PublishPage() {
  return (
    <section className="publish-page">
      <div className="publish-page__inner page-container">
        <header className="publish-intro">
          <h1>选择一种创作方式</h1>
          <p>记录一段生活，或分享一处能被复现的游戏点位。</p>
        </header>

        <div className="publish-entry-layout">
          <article className="publish-life-entry">
            <Link to="/life/create" aria-label="发布生活：记录生活">
              <span className="publish-life-entry__media" aria-hidden="true">
                <img
                  src="/assets/gallery/photo-07.jpg"
                  alt=""
                  width="1280"
                  height="1707"
                  loading="eager"
                  fetchPriority="high"
                />
              </span>

              <span className="publish-life-entry__content">
                <span>
                  <h2>记录生活</h2>
                  <p>把照片、当时的时间和地点，以及几句话，收进生活合集。</p>
                </span>
                <span className="publish-entry-action">
                  发布生活
                  <span aria-hidden="true">→</span>
                </span>
              </span>
            </Link>
          </article>

          <article className="publish-game-entry">
            <Link to="/guide/create" aria-label="发布点位：分享游戏点位">
              <span className="publish-game-entry__heading">
                <h2>分享游戏点位</h2>
                <p>先确认地图和英雄，再写清站位、方向与操作。</p>
              </span>

              <ol className="publish-game-route" aria-label="点位发布内容顺序">
                <li>
                  <strong>地图</strong>
                  <span>选择所在地图</span>
                </li>
                <li>
                  <strong>英雄</strong>
                  <span>明确使用角色</span>
                </li>
                <li>
                  <strong>点位</strong>
                  <span>说明站位与操作</span>
                </li>
              </ol>

              <span className="publish-entry-action">
                发布点位
                <span aria-hidden="true">→</span>
              </span>
            </Link>
          </article>
        </div>
      </div>
    </section>
  )
}
