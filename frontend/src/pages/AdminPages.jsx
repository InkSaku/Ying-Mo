import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import * as admin from '../api/admin.js'
import { createGame, createGameHero, createGameMap, updateGame, updateGameHero, updateGameMap } from '../api/games.js'
import { deleteUnboundImage } from '../api/uploads.js'
import { useAuth } from '../auth/useAuth.js'
import AdminActionDialog from '../components/admin/AdminActionDialog.jsx'
import ImageUploadField from '../components/upload/ImageUploadField.jsx'

function useLoad(loader, deps = []) {
  const ref = useRef(loader)
  const key = deps.join('|')
  const [state, setState] = useState({ loading: true, data: null, error: null })

  useEffect(() => { ref.current = loader }, [loader])

  const load = useCallback(() => {
    setState({ loading: true, data: null, error: null })
    ref.current()
      .then((data) => setState({ loading: false, data, error: null }))
      .catch((error) => setState({ loading: false, data: null, error }))
  }, [])

  useEffect(() => { load() }, [load, key])
  return [state, load]
}

function State({ state, children }) {
  if (state.loading) return <p className="state-message">正在加载…</p>
  if (state.error) return <p className="state-message state-message--error">{state.error.message}</p>
  return children
}

function useDialog() {
  const [dialog, setDialog] = useState(null)
  return [dialog, setDialog]
}

function AdminPageHeader({ eyebrow, title, description, action }) {
  return (
    <header className="admin-page__header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </header>
  )
}

const reasonField = { name: 'reason', label: '操作原因', type: 'textarea', required: true }
const resolutionField = { name: 'resolution_message', label: '对举报者可见的处理说明', type: 'textarea', required: true }
const noteField = { name: 'internal_note', label: '内部备注（不会通知用户）', type: 'textarea' }

function AdminDashboardPage() {
  const [state] = useLoad(admin.getAdminSummary)
  const labels = [
    ['待处理举报', 'pending_report_count'], ['处理中举报', 'in_progress_report_count'],
    ['待审核章节', 'pending_chapter_count'], ['已下架日常', 'hidden_life_post_count'],
    ['已下架教材', 'hidden_guide_count'], ['活跃用户', 'active_user_count'],
    ['今日举报', 'today_report_count'], ['今日管理操作', 'today_admin_action_count'],
  ]

  return <State state={state}>{state.data && <section className="admin-page">
    <AdminPageHeader eyebrow="工作台" title="后台概览" description="快速查看当前需要关注的社区治理事项。" />
    <div className="admin-stats">
      {labels.map(([label, key]) => <div key={key}><strong>{state.data[key]}</strong><span>{label}</span></div>)}
    </div>
  </section>}</State>
}

function AdminReportsPage() {
  const [state, load] = useLoad(() => admin.getAdminReports({ page_size: 50 }))

  return <State state={state}>{state.data && <section className="admin-page">
    <AdminPageHeader
      eyebrow="工作台"
      title="举报管理"
      description="查看并跟进用户提交的社区反馈。"
      action={<button onClick={load}>刷新</button>}
    />
    <div className="admin-list">
      {state.data.data.map((item) => <Link key={item.id} to={`/admin/reports/${item.id}`}>
        <strong>#{item.id} · {item.target_type}</strong>
        <span>{item.reason} · {item.status}</span>
        <small>{new Date(item.created_at).toLocaleString('zh-CN')}</small>
      </Link>)}
    </div>
  </section>}</State>
}

function AdminReportDetailPage() {
  const { id } = useParams()
  const [state, load] = useLoad(() => admin.getAdminReport(id), [id])
  const [dialog, setDialog] = useDialog()
  const simple = async (operation) => { await operation(); load() }
  const submit = async (values) => {
    if (dialog.action === 'reject') await admin.rejectReport(id, values)
    else await admin.resolveReport(id, { action: dialog.action, ...values })
    load()
  }

  return <State state={state}>{state.data && <section className="admin-page">
    <AdminPageHeader eyebrow="社区反馈" title={`举报 #${state.data.id}`} description="核对举报详情后，领取、处理或驳回该反馈。" />
    <div><p>{state.data.reason} · {state.data.status}</p><p>{state.data.description || '无补充说明'}</p></div>
    <pre>{JSON.stringify(state.data.target_snapshot, null, 2)}</pre>
    <div className="admin-actions">
      {state.data.status === 'pending' && <button onClick={() => void simple(() => admin.claimReport(id))}>领取</button>}
      {state.data.status === 'in_progress' && <button onClick={() => void simple(() => admin.releaseReport(id))}>释放</button>}
      {state.data.allowed_actions?.map((action) => <button key={action} onClick={() => setDialog({ action, title: `处理举报：${action}` })}>{action}</button>)}
      <button className="button--danger" onClick={() => setDialog({ action: 'reject', title: '驳回举报' })}>驳回举报</button>
    </div>
    <AdminActionDialog
      open={Boolean(dialog)} title={dialog?.title} description="处理说明会发送给举报者；内部备注仅供后台查看。"
      fields={[resolutionField, noteField, ...(['delete_content', 'ban_user'].includes(dialog?.action) ? [{ name: 'confirmation', label: `输入 ${dialog.action === 'ban_user' ? 'BAN' : 'DELETE'} 确认操作`, required: true }] : [])]}
      dangerous={dialog?.action === 'reject' || ['delete_content', 'ban_user'].includes(dialog?.action)} submitLabel="提交处理"
      onClose={() => setDialog(null)} onSubmit={submit}
    />
  </section>}</State>
}

function AdminUsersPage() {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [state, load] = useLoad(() => admin.getAdminUsers({ page_size: 50, query, role, status }), [query, role, status])

  return <section className="admin-page">
    <AdminPageHeader eyebrow="社区治理" title="用户管理" description="查看账号状态，并按需处理发布、评论和角色权限。" />
    <form className="admin-filters" onSubmit={(event) => { event.preventDefault(); load() }}>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索用户名、昵称或邮箱" />
      <select value={role} onChange={(event) => setRole(event.target.value)}>
        <option value="">全部角色</option><option value="user">普通用户</option><option value="content_admin">内容管理员</option><option value="system_admin">系统管理员</option>
      </select>
      <select value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="">全部状态</option><option value="active">正常</option><option value="banned">封禁</option>
      </select>
      <button>筛选</button>
    </form>
    <State state={state}>{state.data && <div className="admin-list">
      {state.data.data.map((item) => <Link key={item.id} to={`/admin/users/${item.id}`}>
        <strong>{item.nickname} @{item.username}</strong><span>{item.role} · {item.status}</span>
        <small>发布：{item.can_publish ? '允许' : '限制'} / 评论：{item.can_comment ? '允许' : '限制'}</small>
      </Link>)}
    </div>}</State>
  </section>
}

function AdminUserDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [state, load] = useLoad(() => admin.getAdminUser(id), [id])
  const [dialog, setDialog] = useDialog()
  const submit = async (values) => {
    const { kind, payload } = dialog
    if (kind === 'restrictions') await admin.updateUserRestrictions(id, { ...payload, reason: values.reason })
    if (kind === 'status') await admin.updateUserStatus(id, { ...payload, reason: values.reason, ...(payload.status === 'banned' ? { confirmation: values.confirm_text } : {}) })
    if (kind === 'role') await admin.updateUserRole(id, { role: values.role, reason: values.reason })
    load()
  }

  return <State state={state}>{state.data && <section className="admin-page">
    <AdminPageHeader eyebrow="用户详情" title={`${state.data.nickname} @${state.data.username}`} description={`${state.data.email} · ${state.data.role} · ${state.data.status}`} />
    <div className="admin-actions">
      <button disabled={!state.data.can_manage} onClick={() => setDialog({ kind: 'restrictions', title: state.data.can_publish ? '限制发布' : '解除发布限制', payload: { can_publish: !state.data.can_publish } })}>{state.data.can_publish ? '限制发布' : '解除发布限制'}</button>
      <button disabled={!state.data.can_manage} onClick={() => setDialog({ kind: 'restrictions', title: state.data.can_comment ? '禁止评论' : '解除禁止评论', payload: { can_comment: !state.data.can_comment } })}>{state.data.can_comment ? '禁止评论' : '解除禁止评论'}</button>
      {user.role === 'system_admin' && <>
        <button className="button--danger" disabled={!state.data.can_manage} onClick={() => setDialog({ kind: 'status', title: state.data.status === 'banned' ? '解除封禁' : '封禁账号', dangerous: state.data.status !== 'banned', payload: { status: state.data.status === 'banned' ? 'active' : 'banned' } })}>{state.data.status === 'banned' ? '解除封禁' : '封禁账号'}</button>
        <button disabled={!state.data.can_manage} onClick={() => setDialog({ kind: 'role', title: '修改用户角色', payload: {} })}>修改角色</button>
      </>}
    </div>
    <AdminActionDialog
      open={Boolean(dialog)} title={dialog?.title} dangerous={dialog?.dangerous} description="该操作会被写入管理员日志。"
      fields={dialog?.kind === 'role' ? [{ name: 'role', label: '新角色', type: 'select', required: true, value: state.data.role, options: [{ value: 'user', label: '普通用户' }, { value: 'content_admin', label: '内容管理员' }, { value: 'system_admin', label: '系统管理员' }] }, reasonField, ...(dialog?.dangerous ? [{ name: 'confirm_text', label: '输入 BAN 确认封禁', required: true }] : [])] : [reasonField, ...(dialog?.dangerous ? [{ name: 'confirm_text', label: '输入 BAN 确认封禁', required: true }] : [])]}
      submitLabel="保存" onClose={() => setDialog(null)}
      onSubmit={async (values) => { if (dialog?.dangerous && values.confirm_text !== 'BAN') throw new Error('确认词不匹配。'); await submit(values) }}
    />
  </section>}</State>
}

function AdminContentPage() {
  const [tab, setTab] = useState('life')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const loader = tab === 'life' ? admin.getAdminLifePosts : tab === 'guide' ? admin.getAdminGuides : tab === 'comment' ? admin.getAdminComments : null
  const [state, load] = useLoad(() => tab === 'featured' ? admin.getAdminFeatured() : loader({ page_size: 50, query, status }), [tab, query, status])
  const [dialog, setDialog] = useDialog()
  const execute = async (values) => {
    const { item, kind } = dialog
    const type = tab === 'life' ? 'life_post' : 'game_guide'
    if (kind === 'hide') await admin.hideContent(type, item.id, { reason: values.reason })
    if (kind === 'delete') {
      const payload = { reason: values.reason, confirmation: values.confirm_text }
      if (tab === 'comment') await admin.deleteAdminComment(item.id, payload)
      else await admin.deleteAdminContent(type, item.id, payload)
    }
    if (kind === 'invalid') await admin.markGuideInvalid(item.id)
    if (kind === 'comment-hide') await admin.hideComment(item.id)
    load()
  }
  const quick = async (item, kind) => {
    const type = tab === 'life' ? 'life_post' : 'game_guide'
    if (kind === 'restore') await admin.restoreContent(type, item.id)
    if (kind === 'feature') await admin.featureContent(type, item.id, {})
    if (kind === 'unfeature') await admin.unfeatureContent(item.target_type, item.target_id)
    if (kind === 'comment-restore') await admin.restoreComment(item.id)
    load()
  }
  const items = state.data?.data || state.data || []

  return <section className="admin-page">
    <AdminPageHeader eyebrow="社区治理" title="内容管理" description="管理日常、教材、评论与编辑精选，保持内容清晰可信。" />
    <div className="account-tabs">
      {[['life', '日常'], ['guide', '教材'], ['comment', '评论'], ['featured', '编辑精选']].map(([key, label]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}
    </div>
    {tab !== 'featured' && <form className="admin-filters" onSubmit={(event) => { event.preventDefault(); load() }}>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题或评论" />
      <select value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="">全部状态</option><option value="published">已发布</option><option value="hidden">已下架/隐藏</option><option value="active">正常评论</option><option value="deleted">已删除评论</option>
      </select>
      <button>筛选</button>
    </form>}
    <State state={state}><div className="admin-list">
      {items.map((item) => <article key={item.id || `${item.target_type}-${item.target_id}`}>
        <strong>{item.title || item.content?.title || item.body || `评论 #${item.id}`}</strong>
        <span>{item.status || item.content?.status || item.target_type}</span>
        <div className="admin-list__actions">
          {tab === 'comment' ? <>
            {item.status === 'active' && <button onClick={() => setDialog({ item, kind: 'comment-hide', title: '隐藏评论' })}>隐藏</button>}
            {item.status === 'hidden' && <button onClick={() => void quick(item, 'comment-restore')}>恢复</button>}
            {item.status !== 'deleted' && <button className="button--danger" onClick={() => setDialog({ item, kind: 'delete', title: '永久删除评论', dangerous: true })}>删除</button>}
          </> : tab === 'featured' ? <button onClick={() => void quick(item, 'unfeature')}>取消精选</button> : <>
            {item.status === 'published' ? <><button onClick={() => setDialog({ item, kind: 'hide', title: '下架内容' })}>下架</button><button onClick={() => void quick(item, 'feature')}>精选</button></> : <button onClick={() => void quick(item, 'restore')}>恢复</button>}
            {tab === 'guide' && <button onClick={() => setDialog({ item, kind: 'invalid', title: '标记教材失效' })}>标记失效</button>}
            <button className="button--danger" onClick={() => setDialog({ item, kind: 'delete', title: '永久删除内容', dangerous: true })}>永久删除</button>
          </>}
        </div>
      </article>)}
    </div></State>
    <AdminActionDialog
      open={Boolean(dialog)} title={dialog?.title} dangerous={dialog?.dangerous}
      fields={[...(dialog?.kind === 'hide' || dialog?.dangerous ? [reasonField] : []), ...(dialog?.dangerous ? [{ name: 'confirm_text', label: '输入 DELETE 确认删除', required: true }] : [])]}
      submitLabel="确认" onClose={() => setDialog(null)}
      onSubmit={async (values) => { if (dialog?.dangerous && values.confirm_text !== 'DELETE') throw new Error('确认词不匹配。'); await execute(values) }}
    />
  </section>
}

function AdminChaptersPage() {
  const [filter, setFilter] = useState('pending')
  const [state, load] = useLoad(() => admin.getAdminChapters({ page_size: 50, ...(filter === 'disabled' ? { status: 'disabled' } : filter === 'merged' ? { status: 'merged' } : { review_status: filter }) }), [filter])
  const [dialog, setDialog] = useDialog()
  const submit = async (values) => {
    const { item, type } = dialog
    if (type === 'reject') await admin.rejectChapter(item.id, { review_note: values.resolution_message })
    if (type === 'edit') await admin.updateAdminChapter(item.id, { name: values.name, aliases: values.aliases.split(',').map((value) => value.trim()).filter(Boolean) })
    if (type === 'merge') await admin.mergeChapter(item.id, { target_chapter_id: Number(values.target_chapter_id), reason: values.reason })
    load()
  }
  const quick = async (item, type) => {
    if (type === 'approve') await admin.approveChapter(item.id, {})
    if (type === 'disable') await admin.disableChapter(item.id)
    if (type === 'enable') await admin.enableChapter(item.id)
    load()
  }

  return <section className="admin-page">
    <AdminPageHeader eyebrow="社区治理" title="章节管理" description="审核、维护和合并社区共同使用的生活章节。" />
    <div className="account-tabs">
      {[['pending', '待审核'], ['approved', '已通过'], ['rejected', '已驳回'], ['disabled', '已禁用'], ['merged', '已合并']].map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}
    </div>
    <State state={state}>{state.data && <div className="admin-list">
      {state.data.data.map((item) => <article key={item.id}>
        <strong>{item.name}</strong><span>{item.review_status} · {item.status}</span><small>{item.review_note || '暂无审核意见'}</small>
        <div className="admin-list__actions">
          {item.review_status === 'pending' && <><button onClick={() => void quick(item, 'approve')}>通过</button><button onClick={() => setDialog({ item, type: 'reject', title: '驳回章节' })}>驳回</button></>}
          {item.status === 'active' && <button onClick={() => void quick(item, 'disable')}>禁用</button>}
          {item.status === 'disabled' && <button onClick={() => void quick(item, 'enable')}>启用</button>}
          <button onClick={() => setDialog({ item, type: 'edit', title: '编辑章节' })}>编辑</button>
          {item.status === 'active' && <button className="button--danger" onClick={() => setDialog({ item, type: 'merge', title: '合并章节', dangerous: true })}>合并</button>}
        </div>
      </article>)}
    </div>}</State>
    <AdminActionDialog
      open={Boolean(dialog)} title={dialog?.title} dangerous={dialog?.dangerous}
      fields={dialog?.type === 'reject' ? [resolutionField] : dialog?.type === 'edit' ? [{ name: 'name', label: '章节名称', required: true, value: dialog.item.name }, { name: 'aliases', label: '别名（逗号分隔）', value: (dialog.item.aliases || []).join(',') }] : [{ name: 'target_chapter_id', label: '目标章节 ID', type: 'number', required: true }, reasonField, { name: 'confirm_text', label: '输入 MERGE 确认迁移', required: true }]}
      submitLabel="保存" onClose={() => setDialog(null)}
      onSubmit={async (values) => { if (dialog?.type === 'merge' && values.confirm_text !== 'MERGE') throw new Error('确认词不匹配。'); await submit(values) }}
    />
  </section>
}

function CatalogEditor({ type, item, game, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ name_zh: item?.name_zh || '', name_en: item?.name_en || '', aliases: (item?.aliases || []).join(','), icon_media_id: undefined, cover_media_id: undefined, avatar_media_id: undefined }))
  const uploaded = useRef(new Map())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  useEffect(() => () => { uploaded.current.forEach((publicId) => { void deleteUnboundImage(publicId).catch(() => {}) }) }, [])
  const image = (label, url, key) => <ImageUploadField
    key={key} label={label} purpose="content" currentImageUrl={form[`${key}_url`] ?? (form[key] === undefined ? url : null)} disabled={saving}
    onUploaded={async (media) => {
      if (form[key] && uploaded.current.has(form[key])) { await deleteUnboundImage(uploaded.current.get(form[key])).catch(() => {}); uploaded.current.delete(form[key]) }
      uploaded.current.set(media.id, media.public_id)
      setForm((current) => ({ ...current, [key]: media.id, [`${key}_url`]: media.thumbnail_url }))
    }}
    onRemove={async () => {
      if (form[key] && uploaded.current.has(form[key])) { await deleteUnboundImage(uploaded.current.get(form[key])); uploaded.current.delete(form[key]) }
      setForm((current) => ({ ...current, [key]: null, [`${key}_url`]: null }))
    }}
  />
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError(null)
    const nameZh = form.name_zh.trim()
    if (!nameZh) throw new Error('请填写中文名。')
    const nameEn = form.name_en.trim()
    const base = { name_zh: nameZh, name_en: nameEn || null, aliases: form.aliases.split(',').map((value) => value.trim()).filter(Boolean) }
    let savedItem
    if (type === 'game') {
      const payload = { ...base, ...(form.icon_media_id !== undefined ? { icon_media_id: form.icon_media_id } : {}), ...(form.cover_media_id !== undefined ? { cover_media_id: form.cover_media_id } : {}) }
      savedItem = item ? await updateGame(item.id, payload) : await createGame(payload)
    } else {
      if (!game) throw new Error('请先选择所属游戏。')
      const imageKey = type === 'hero' ? 'avatar_media_id' : 'cover_media_id'
      const payload = { ...base, ...(form[imageKey] !== undefined ? { [imageKey]: form[imageKey] } : {}) }
      if (type === 'hero') savedItem = item ? await updateGameHero(game.id, item.id, payload) : await createGameHero(game.id, payload)
      else savedItem = item ? await updateGameMap(game.id, item.id, payload) : await createGameMap(game.id, payload)
    }
    uploaded.current.clear(); onSaved(savedItem)
  }

  return <form className="catalog-editor" onSubmit={(event) => void save(event).catch((requestError) => { setError(requestError.message); setSaving(false) })}>
    <h3>{item ? '编辑' : '新建'}{type === 'game' ? '游戏' : type === 'hero' ? '英雄' : '地图'}</h3>
    {type !== 'game' && <div className="catalog-editor__parent"><span>所属游戏</span><strong>{game?.name_zh}</strong></div>}
    <label>中文名<input required value={form.name_zh} onChange={(event) => setForm((current) => ({ ...current, name_zh: event.target.value }))} /></label>
    <label>英文名（可选）<input value={form.name_en} placeholder="例如 Overwatch" onChange={(event) => setForm((current) => ({ ...current, name_en: event.target.value }))} /></label>
    <label>别名（可选）<input value={form.aliases} placeholder="多个别名使用逗号分隔" onChange={(event) => setForm((current) => ({ ...current, aliases: event.target.value }))} /></label>
    {type === 'game' && <div className="catalog-editor__images">{image('游戏图标（可选）', item?.icon_thumbnail_url || item?.icon_url, 'icon_media_id')}{image('游戏封面（可选）', item?.cover_thumbnail_url || item?.cover_url, 'cover_media_id')}</div>}
    {type === 'hero' && image('英雄头像（可选）', item?.avatar_thumbnail_url || item?.avatar_url, 'avatar_media_id')}
    {type === 'map' && image('地图封面（可选）', item?.cover_thumbnail_url || item?.cover_url, 'cover_media_id')}
    {error && <p className="form-feedback form-feedback--error">{error}</p>}
    <div className="catalog-editor__actions"><button type="button" onClick={onClose} disabled={saving}>取消</button><button className="button button--primary" disabled={saving}>{saving ? '保存中…' : '保存'}</button></div>
  </form>
}

function AdminCatalogPage() {
  const [search, setSearch] = useSearchParams()
  const selectedGameId = Number(search.get('game')) || null
  const section = search.get('section') === 'maps' ? 'maps' : 'heroes'
  const [gameQuery, setGameQuery] = useState('')
  const [catalogQuery, setCatalogQuery] = useState('')
  const [editing, setEditing] = useState(undefined)
  const [gamesState, reloadGames] = useLoad(() => admin.getAdminGames({ page_size: 50, query: gameQuery }), [gameQuery])
  const [selectedGameState, reloadSelectedGame] = useLoad(() => selectedGameId ? admin.getAdminGame(selectedGameId) : Promise.resolve(null), [String(selectedGameId || '')])
  const [catalogState, reloadCatalog] = useLoad(() => {
    if (!selectedGameId) return Promise.resolve(null)
    const loader = section === 'heroes' ? admin.getAdminGameHeroes : admin.getAdminGameMaps
    return loader(selectedGameId, { page_size: 50, query: catalogQuery })
  }, [String(selectedGameId || ''), section, catalogQuery])

  const updateSearch = (updates) => {
    const next = new URLSearchParams(search)
    Object.entries(updates).forEach(([key, value]) => {
      if (value == null) next.delete(key)
      else next.set(key, String(value))
    })
    setSearch(next)
  }
  const openGame = (gameId) => { setEditing(undefined); updateSearch({ game: gameId, section: 'heroes' }) }
  const closeWorkspace = () => { setEditing(undefined); updateSearch({ game: null, section: null }) }
  const selectedGame = selectedGameState.data
  const sectionLabel = section === 'heroes' ? '英雄' : '地图'
  const sectionType = section === 'heroes' ? 'hero' : 'map'
  const openEditor = (type, item = null) => setEditing({ type, item })
  const handleSaved = (savedItem) => {
    const savedEditor = editing
    setEditing(undefined)
    if (savedEditor?.type === 'game') {
      reloadGames()
      if (!savedEditor.item) openGame(savedItem.id)
      else reloadSelectedGame()
      return
    }
    reloadCatalog(); reloadSelectedGame()
  }

  if (!selectedGameId) return <section className="admin-page admin-catalog-home">
    <AdminPageHeader eyebrow="社区治理" title="游戏目录" description="管理社区中的游戏，以及每款游戏对应的英雄和地图。" action={<button className="button button--primary" onClick={() => openEditor('game')}>新建游戏</button>} />
    <form className="admin-catalog-toolbar" onSubmit={(event) => { event.preventDefault(); reloadGames() }}>
      <input value={gameQuery} onChange={(event) => setGameQuery(event.target.value)} placeholder="搜索游戏名称或别名" />
      <button>筛选</button>
    </form>
    {editing?.type === 'game' && <CatalogEditor type="game" item={editing.item} onClose={() => setEditing(undefined)} onSaved={handleSaved} />}
    <State state={gamesState}>{gamesState.data && (gamesState.data.data.length ? <div className="admin-game-grid">
      {gamesState.data.data.map((game) => <article className="admin-game-card" key={game.id}>
        <div className="admin-game-card__media">{game.icon_thumbnail_url || game.icon_url ? <img src={game.icon_thumbnail_url || game.icon_url} alt="" /> : <span aria-hidden="true">映</span>}</div>
        <div className="admin-game-card__identity"><strong>{game.name_zh}</strong>{game.name_en && <small>{game.name_en}</small>}<span>{game.current_version || '未标注版本'}</span></div>
        <div className="admin-game-card__meta"><span>{game.status}</span><span>{game.hero_count} 位英雄</span><span>{game.map_count} 张地图</span></div>
        <div className="admin-game-card__actions"><button onClick={() => openEditor('game', game)}>编辑游戏</button><button className="button button--primary" onClick={() => openGame(game.id)}>管理章节</button></div>
      </article>)}
    </div> : <p className="state-message">还没有游戏目录。创建第一款游戏后，再为它补充英雄和地图。</p>)}</State>
  </section>

  if (selectedGameState.loading) return <section className="admin-page admin-game-workspace"><p className="state-message">正在加载游戏目录…</p></section>
  if (selectedGameState.error) return <section className="admin-page admin-game-workspace"><p className="state-message state-message--error">{selectedGameState.error.message}</p><button className="admin-game-workspace__back" onClick={closeWorkspace}>返回游戏目录</button></section>
  if (!selectedGame) return <section className="admin-page admin-game-workspace"><p className="state-message">没有找到该游戏。</p><button className="admin-game-workspace__back" onClick={closeWorkspace}>返回游戏目录</button></section>

  return <section className="admin-page admin-game-workspace">
    <button className="admin-game-workspace__back" onClick={closeWorkspace}>返回游戏目录</button>
    <header className="admin-game-header">
      <div className="admin-game-header__identity">
        <div className="admin-game-header__icon">{selectedGame.icon_thumbnail_url || selectedGame.icon_url ? <img src={selectedGame.icon_thumbnail_url || selectedGame.icon_url} alt="" /> : <span aria-hidden="true">映</span>}</div>
        <div className="admin-game-header__meta"><p>当前正在管理：{selectedGame.name_zh}</p><h2>{selectedGame.name_zh}</h2>{selectedGame.name_en && <span>{selectedGame.name_en}</span>}<small>{selectedGame.current_version || '未标注版本'} · {selectedGame.status} · {selectedGame.hero_count} 位英雄 · {selectedGame.map_count} 张地图</small></div>
      </div>
      <button onClick={() => openEditor('game', selectedGame)}>编辑游戏</button>
    </header>
    <div className="admin-game-sections account-tabs" aria-label="游戏目录分类">
      <button aria-pressed={section === 'heroes'} onClick={() => { setEditing(undefined); updateSearch({ section: 'heroes' }) }}>英雄</button>
      <button aria-pressed={section === 'maps'} onClick={() => { setEditing(undefined); updateSearch({ section: 'maps' }) }}>地图</button>
    </div>
    {editing && <CatalogEditor type={editing.type} item={editing.item} game={selectedGame} onClose={() => setEditing(undefined)} onSaved={handleSaved} />}
    <section className="admin-catalog-section">
      <header className="admin-catalog-section__header"><div><h3>{selectedGame.name_zh} · {sectionLabel}</h3><p>{section === 'heroes' ? '维护这款游戏可供教材选择的英雄。' : '维护这款游戏可供教材选择的地图。'}</p></div><button className="button button--primary" onClick={() => openEditor(sectionType)}>新建{sectionLabel}</button></header>
      <form className="admin-catalog-toolbar" onSubmit={(event) => { event.preventDefault(); reloadCatalog() }}><input value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder={`搜索${sectionLabel}名称或别名`} /><button>筛选</button></form>
      <State state={catalogState}>{catalogState.data && (catalogState.data.data.length ? <div className="admin-catalog-items">
        {catalogState.data.data.map((item) => <article className="admin-catalog-item" key={item.id}>
          <div className="admin-catalog-item__image">{(section === 'heroes' ? item.avatar_thumbnail_url || item.avatar_url : item.cover_thumbnail_url || item.cover_url) ? <img src={section === 'heroes' ? item.avatar_thumbnail_url || item.avatar_url : item.cover_thumbnail_url || item.cover_url} alt="" /> : <span aria-hidden="true">映</span>}</div>
          <div className="admin-catalog-item__body"><strong>{item.name_zh}</strong>{item.name_en && <small>{item.name_en}</small>}<span>{section === 'heroes' ? item.role || '未标注定位' : item.map_type || '未标注类型'}</span></div>
          <div className="admin-catalog-item__status"><span>{section === 'heroes' ? item.status : item.current_status}</span><span>{item.review_status}</span></div>
          <div className="admin-catalog-item__actions"><button onClick={() => openEditor(sectionType, item)}>编辑</button></div>
        </article>)}
      </div> : <p className="state-message">{section === 'heroes' ? <>这款游戏还没有英雄。创建第一个英雄后，用户发布教材时就可以选择它。</> : <>这款游戏还没有地图。创建第一张地图后，用户发布教材时就可以选择它。</>}</p>)}</State>
    </section>
  </section>
}

function AdminLogsPage() {
  const [action, setAction] = useState('')
  const [target, setTarget] = useState('')
  const [state, load] = useLoad(() => admin.getAdminLogs({ page_size: 50, action, target_type: target }), [action, target])
  const [selected, setSelected] = useState(null)

  return <section className="admin-page">
    <AdminPageHeader eyebrow="系统" title="管理员操作日志" description="查看高风险操作的记录与前后数据。" />
    <form className="admin-filters" onSubmit={(event) => { event.preventDefault(); load() }}>
      <input value={action} onChange={(event) => setAction(event.target.value)} placeholder="action" />
      <input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="target_type" />
      <button>筛选</button>
    </form>
    <State state={state}>{state.data && <div className="admin-list">
      {state.data.data.map((item) => <article key={item.id}>
        <strong>{item.action}</strong><span>{item.target_type} #{item.target_id || '—'}</span><small>{item.created_at}</small>
        <div className="admin-list__actions"><button onClick={() => setSelected(item)}>查看详情</button></div>
      </article>)}
    </div>}
    {selected && <section className="admin-log-detail"><h3>日志 #{selected.id}</h3><pre>{JSON.stringify({ before_data: selected.before_data, after_data: selected.after_data, metadata: selected.metadata }, null, 2)}</pre><button onClick={() => setSelected(null)}>关闭</button></section>}
    </State>
  </section>
}

export { AdminCatalogPage, AdminChaptersPage, AdminContentPage, AdminDashboardPage, AdminLogsPage, AdminReportDetailPage, AdminReportsPage, AdminUserDetailPage, AdminUsersPage }
