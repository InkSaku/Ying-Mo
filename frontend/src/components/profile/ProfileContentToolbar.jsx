export default function ProfileContentToolbar({
  tab,
  sort,
  stats,
  total,
  onTabChange,
  onSortChange,
}) {
  const tabs = [
    { key: 'posts', label: '日常', count: stats.life_post_count },
    { key: 'guides', label: '游戏教材', count: stats.guide_count },
  ]

  return (
    <div className="profile-content-toolbar">
      <div className="profile-content-toolbar__heading">
        <div>
          <p className="eyebrow">创作记录</p>
          <h2 id="profile-content-title">在生活与经验之间继续浏览</h2>
        </div>
        <p>{typeof total === 'number' ? `当前共有 ${total} 条可见内容` : '只展示你当前有权查看的公开内容'}</p>
      </div>

      <div className="profile-content-toolbar__controls">
        <div className="profile-content-tabs" role="tablist" aria-label="创作类型">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={tab === item.key ? 'is-current' : ''}
              onClick={() => onTabChange(item.key)}
            >
              <span>{item.label}</span>
              <small>{item.count}</small>
            </button>
          ))}
        </div>

        <label className="profile-content-sort">
          <span>排序</span>
          <select value={sort} onChange={(event) => onSortChange(event.target.value)}>
            <option value="latest">最新发布</option>
            <option value="updated">最近更新</option>
          </select>
        </label>
      </div>
    </div>
  )
}
