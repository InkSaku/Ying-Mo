import { useEffect, useId, useRef } from 'react'

import AuthenticatedMedia from '../common/AuthenticatedMedia.jsx'

const kindLabels = {
  life_post: '日常',
  game_guide: '游戏点位',
  comment: '评论',
}

const statusLabels = {
  active: '正常',
  deleted: '已删除',
  hidden: '已下架',
  published: '已发布',
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value))
}

export default function AdminContentPreviewDialog({ item, kind, featured, pending, onClose, onToggleFeature, onHide, onDelete }) {
  const headingId = useId()
  const closeButtonRef = useRef(null)
  const content = item?.content || item
  const title = content?.title || content?.body || `评论 #${content?.id || item?.target_id}`
  const author = content?.author?.nickname || content?.author?.username || '社区成员'
  const status = content?.status || item?.status || 'published'
  const media = kind === 'life_post' ? (content?.images || content?.media || []) : kind === 'game_guide' ? (content?.steps || []) : []

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape' && !pending) onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, pending])

  useEffect(() => {
    if (!item) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    return () => { document.body.style.overflow = previousOverflow }
  }, [item])

  if (!item) return null

  return <div className="admin-content-preview__backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose() }}>
    <section className="admin-content-preview" role="dialog" aria-modal="true" aria-labelledby={headingId}>
      <header className="admin-content-preview__header">
        <div>
          <p>{kindLabels[kind] || '内容预览'}</p>
          <h2 id={headingId}>{title}</h2>
          <span>{author} · {formatDate(content?.created_at)}</span>
        </div>
        <button ref={closeButtonRef} type="button" aria-label="关闭内容预览" disabled={pending} onClick={onClose}>×</button>
      </header>

      <div className="admin-content-preview__scroll">
        <section className="admin-content-preview__summary" aria-label="内容概况">
          <span className={`admin-status admin-status--${status}`}>{statusLabels[status] || status}</span>
          {kind === 'life_post' && <><span>可见范围：{content.visibility === 'public' ? '公开' : content.visibility === 'login_only' ? '登录可见' : '仅自己'}</span>{content.location && <span>地点：{content.location}</span>}{content.mood && <span>心情：{content.mood}</span>}</>}
          {kind === 'game_guide' && <><span>地图：{content.map?.name_zh || '—'}</span><span>英雄：{content.hero?.name_zh || '—'}</span><span>分类：{content.category || '—'}</span></>}
          {featured && <span className="admin-content-preview__featured-state">★ 已加入编辑推荐</span>}
        </section>

        {media.length > 0 && <div className={`admin-content-preview__media ${media.length > 1 ? 'has-gallery' : ''}`}>
          {media.slice(0, 6).map((entry, index) => <AuthenticatedMedia key={entry.id || entry.media_id || index} src={entry.url || entry.thumbnail_url} alt={`${title}媒体 ${index + 1}`} fit="cover" />)}
        </div>}

        <section className="admin-content-preview__body">
          <p className="eyebrow">完整内容</p>
          {kind === 'life_post' && <p>{content.body || '这条日常没有文字正文。'}</p>}
          {kind === 'game_guide' && <>
            <p>{content.instructions || '这条点位没有文字说明。'}</p>
            {(content.skill || content.aim_reference || content.notes) && <dl>
              {content.skill && <div><dt>技能</dt><dd>{content.skill}</dd></div>}
              {content.aim_reference && <div><dt>瞄准参照</dt><dd>{content.aim_reference}</dd></div>}
              {content.notes && <div><dt>补充说明</dt><dd>{content.notes}</dd></div>}
            </dl>}
          </>}
          {kind === 'comment' && <p>{content.body || '这条评论没有可显示的正文。'}</p>}
          {item.note && <aside><strong>精选备注</strong><span>{item.note}</span></aside>}
        </section>

        {content.tags?.length > 0 && <div className="admin-content-preview__tags">{content.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
      </div>

      <footer className="admin-content-preview__footer">
        <div>
          <button type="button" className="admin-content-action admin-content-action--hide" disabled={pending || (kind === 'comment' ? status !== 'active' : status !== 'published')} onClick={onHide}>{kind === 'comment' ? '隐藏' : '下架'}</button>
          <button type="button" className="button button--danger" disabled={pending} onClick={onDelete}>永久删除</button>
        </div>
        {kind !== 'comment' && status === 'published' && <button
          type="button"
          className={`admin-content-preview__star ${featured ? 'is-active' : ''}`}
          aria-pressed={featured}
          aria-label={featured ? '取消精选' : '加入精选'}
          disabled={pending}
          onClick={onToggleFeature}
        >
          <span aria-hidden="true">★</span>
          {pending ? '处理中…' : featured ? '已加入推荐' : '加入编辑推荐'}
        </button>}
      </footer>
    </section>
  </div>
}
