import { Link } from 'react-router-dom'

export function ProfileHeroSkeleton() {
  return (
    <section className="public-profile-page page-container" aria-label="正在加载用户资料">
      <div className="public-profile-hero public-profile-hero--skeleton" aria-hidden="true">
        <div className="public-profile-hero__main">
          <span className="profile-skeleton profile-skeleton--avatar" />
          <div className="profile-skeleton-copy">
            <span className="profile-skeleton profile-skeleton--eyebrow" />
            <span className="profile-skeleton profile-skeleton--title" />
            <span className="profile-skeleton profile-skeleton--line" />
            <span className="profile-skeleton profile-skeleton--line profile-skeleton--short" />
          </div>
        </div>
        <div className="public-profile-stats">
          {[0, 1, 2].map((item) => <span key={item} className="profile-skeleton profile-skeleton--stat" />)}
        </div>
      </div>
    </section>
  )
}

export function ProfileContentSkeleton({ tab }) {
  return (
    <div className={`profile-content-grid profile-content-grid--${tab}`} aria-label="正在加载内容">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className={`profile-content-skeleton profile-content-skeleton--${tab}`} aria-hidden="true">
          <span className="profile-skeleton profile-skeleton--media" />
          <span className="profile-skeleton profile-skeleton--line" />
          <span className="profile-skeleton profile-skeleton--line profile-skeleton--short" />
        </div>
      ))}
    </div>
  )
}

export function ProfileEmptyState({ tab, self }) {
  const isPosts = tab === 'posts'
  const title = isPosts ? '这里还没有生活记录' : '这里还没有游戏教材'
  const description = self
    ? isPosts
      ? '把一张照片、一段心情，或普通的一天留在映墨。'
      : '用图文步骤把一次实战中的发现整理下来。'
    : `这位用户暂时没有对你可见的${isPosts ? '日常' : '教材'}。`

  return (
    <div className="profile-empty-state">
      <span aria-hidden="true">{isPosts ? '日' : '技'}</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {self && (
        <Link className="button button--primary" to={isPosts ? '/life/create' : '/guide/create'}>
          {isPosts ? '发布第一条日常' : '发布第一篇教材'}
        </Link>
      )}
    </div>
  )
}

export function ProfileNotFound() {
  return (
    <section className="public-profile-page page-container">
      <div className="profile-missing-state">
        <p className="eyebrow">公开主页</p>
        <h1>没有找到这位用户</h1>
        <p>这个主页可能不存在，或对应账号目前无法访问。</p>
        <div>
          <Link className="button button--primary" to="/">返回首页</Link>
          <Link className="button" to="/discover">浏览发现</Link>
        </div>
      </div>
    </section>
  )
}
