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

const adminLabels = {
  target: {
    life_post: '日常',
    game_guide: '游戏教材',
    comment: '评论',
    user: '用户',
  },
  status: {
    active: '正常',
    approved: '已通过',
    banned: '已封禁',
    deactivated: '已停用',
    hidden: '已下架',
    in_progress: '处理中',
    pending: '待处理',
    published: '已发布',
    rejected: '已驳回',
    resolved: '已处理',
  },
  role: {
    user: '普通用户',
    content_admin: '内容管理员',
    system_admin: '系统管理员',
  },
  reason: {
    spam: '垃圾或广告',
    harassment: '骚扰或攻击',
    inappropriate: '不当内容',
    misinformation: '错误或误导信息',
    copyright: '侵权内容',
    other: '其他问题',
  },
}

function adminLabel(group, value) {
  return adminLabels[group]?.[value] || value || '—'
}

function AdminDashboardPage() {
  const [state] = useLoad(admin.getAdminSummary)

  return <State state={state}>{state.data && (() => {
    const attentionItems = [
      { label: '待处理举报', key: 'pending_report_count', description: '等待管理员领取', to: '/admin/reports', tone: 'urgent' },
      { label: '处理中举报', key: 'in_progress_report_count', description: '已进入处理流程', to: '/admin/reports', tone: 'active' },
      { label: '待审核章节', key: 'pending_chapter_count', description: '等待内容审核', to: '/admin/chapters', tone: 'review' },
      { label: '今日新增举报', key: 'today_report_count', description: '今日收到的社区反馈', to: '/admin/reports', tone: 'neutral' },
    ]
    const operationItems = [
      { label: '活跃用户', key: 'active_user_count', description: '当前正常账号' },
      { label: '已下架日常', key: 'hidden_life_post_count', description: '进入治理状态' },
      { label: '已下架教材', key: 'hidden_guide_count', description: '进入治理状态' },
      { label: '今日管理操作', key: 'today_admin_action_count', description: '今日已记录动作' },
    ]
    const attentionTotal = state.data.pending_report_count + state.data.in_progress_report_count + state.data.pending_chapter_count

    return <section className="admin-page admin-dashboard">
      <AdminPageHeader eyebrow="工作台" title="后台概览" description="先处理需要判断的事项，再查看社区运行状态。" />

      <section className="admin-dashboard__hero">
        <div className="admin-dashboard__hero-copy">
          <p className="admin-dashboard__kicker">今日治理焦点</p>
          <h3>{attentionTotal > 0 ? `还有 ${attentionTotal} 项需要关注` : '当前没有积压事项'}</h3>
          <p>{attentionTotal > 0 ? '建议优先处理举报与章节审核，让社区内容保持清晰、友善和可信。' : '举报和章节审核暂时没有积压，可以继续查看今日社区运行数据。'}</p>
        </div>
        <div className="admin-dashboard__total">
          <span>当前待关注</span>
          <strong>{attentionTotal}</strong>
          <small>举报与章节审核</small>
        </div>
      </section>

      <section className="admin-dashboard__section">
        <header className="admin-dashboard__section-header">
          <h3>优先处理</h3>
          <p>点击对应事项进入处理页面</p>
        </header>
        <div className="admin-dashboard__priority-grid">
          {attentionItems.map((item) => <Link className="admin-dashboard__priority-card" data-tone={item.tone} key={item.key} to={item.to}>
            <span className="admin-dashboard__priority-value">
              <strong>{state.data[item.key]}</strong>
              <span>查看 →</span>
            </span>
            <span className="admin-dashboard__priority-copy">
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
          </Link>)}
        </div>
      </section>

      <section className="admin-dashboard__section">
        <header className="admin-dashboard__section-header">
          <h3>社区运行</h3>
          <p>用于快速了解当前治理状态</p>
        </header>
        <div className="admin-dashboard__metrics">
          {operationItems.map((item) => <div className="admin-dashboard__metric" key={item.key}>
            <span>{item.label}</span>
            <strong>{state.data[item.key]}</strong>
            <small>{item.description}</small>
          </div>)}
        </div>
      </section>
    </section>
  })()}</State>
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
        <strong>#{item.id} · {adminLabel('target', item.target_type)}</strong>
        <span className="admin-list__meta">
          <span>{adminLabel('reason', item.reason)}</span>
          <span className={`admin-status admin-status--${item.status}`}>{adminLabel('status', item.status)}</span>
        </span>
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
        <strong>{item.nickname} @{item.username}</strong>
        <span className="admin-list__meta">
          <span>{adminLabel('role', item.role)}</span>
          <span className={`admin-status admin-status--${item.status}`}>{adminLabel('status', item.status)}</span>
        </span>
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
  const [bulk, setBulk] = useState({ game_id: '', map_id: '', hero_id: '', reason: '' })
  const [bulkFeedback, setBulkFeedback] = useState({ error: '', message: '' })
  const execute = async (values) => {
    const { item, kind } = dialog
    const type = tab === 'life' ? 'life_post' : 'game_guide'
    if (kind === 'hide') await admin.hideContent(type, item.id, { reason: values.reason })
    if (kind === 'delete') {
      const payload = { reason: values.reason, confirmation: values.confirm_text }
      if (tab === 'comment') await admin.deleteAdminComment(item.id, payload)
      else await admin.deleteAdminContent(type, item.id, payload)
    }
    if (kind === 'validity') await admin.updateGuideValidity(item.id, { validity_status: values.validity_status, reason: values.reason })
    if (kind === 'metadata') await admin.updateGuideMetadata(item.id, { game_id: Number(values.game_id), map_id: Number(values.map_id), hero_id: Number(values.hero_id), category: values.category, reason: values.reason })
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
    <AdminPageHeader eyebrow="社区治理" title="内容管理" description="管理日常、点位、评论与编辑精选，保持内容清晰可信。" />
    <div className="account-tabs">
      {[['life', '日常'], ['guide', '点位'], ['comment', '评论'], ['featured', '编辑精选']].map(([key, label]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}
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
          {tab === 'guide' && <small>地图：{item.map?.name_zh || '—'} · 英雄：{item.hero?.name_zh || '—'} · 分类：{item.category} · 反馈：有效 {item.validity_feedback?.valid || 0} / 可能失效 {item.validity_feedback?.possibly_invalid || 0}</small>}
        <span>{item.status || item.content?.status || item.target_type}</span>
        <div className="admin-list__actions">
          {tab === 'comment' ? <>
            {item.status === 'active' && <button onClick={() => setDialog({ item, kind: 'comment-hide', title: '隐藏评论' })}>隐藏</button>}
            {item.status === 'hidden' && <button onClick={() => void quick(item, 'comment-restore')}>恢复</button>}
            {item.status !== 'deleted' && <button className="button--danger" onClick={() => setDialog({ item, kind: 'delete', title: '永久删除评论', dangerous: true })}>删除</button>}
          </> : tab === 'featured' ? <button onClick={() => void quick(item, 'unfeature')}>取消精选</button> : <>
            {item.status === 'published' ? <><button onClick={() => setDialog({ item, kind: 'hide', title: '下架内容' })}>下架</button><button onClick={() => void quick(item, 'feature')}>精选</button></> : <button onClick={() => void quick(item, 'restore')}>恢复</button>}
            {tab === 'guide' && <><button onClick={() => setDialog({ item, kind: 'metadata', title: '修正点位地图、英雄与分类' })}>修正关联</button><button onClick={() => setDialog({ item, kind: 'validity', title: '更新点位有效状态' })}>有效状态</button></>}
            <button className="button--danger" onClick={() => setDialog({ item, kind: 'delete', title: '永久删除内容', dangerous: true })}>永久删除</button>
          </>}
        </div>
      </article>)}
    </div></State>
    {tab === 'guide' && <section className="admin-governance-bulk">
      <h3>按目录批量标记可能失效</h3>
      <p>适用于版本、地图轮换或英雄调整后发起复核。不会删除任何历史点位。</p>
      <form className="admin-filters" onSubmit={async (event) => {
        event.preventDefault()
        setBulkFeedback({ error: '', message: '' })
        try {
          const result = await admin.bulkMarkGuidesPossiblyInvalid({ game_id: Number(bulk.game_id), ...(bulk.map_id ? { map_id: Number(bulk.map_id) } : {}), ...(bulk.hero_id ? { hero_id: Number(bulk.hero_id) } : {}), reason: bulk.reason, confirmation: 'BULK_POSSIBLY_INVALID' })
          setBulkFeedback({ error: '', message: result.already_processed ? '这次批量操作已经处理过，没有重复执行。' : `已标记 ${result.updated} 个点位为可能失效。` })
          load()
        } catch (error) {
          setBulkFeedback({ error: error.message, message: '' })
        }
      }}>
        <input aria-label="批量操作游戏 ID" required placeholder="游戏 ID" value={bulk.game_id} onChange={(event) => setBulk({ ...bulk, game_id: event.target.value })} />
        <input aria-label="批量操作地图 ID" placeholder="地图 ID（至少地图或英雄其一）" value={bulk.map_id} onChange={(event) => setBulk({ ...bulk, map_id: event.target.value })} />
        <input aria-label="批量操作英雄 ID" placeholder="英雄 ID（至少地图或英雄其一）" value={bulk.hero_id} onChange={(event) => setBulk({ ...bulk, hero_id: event.target.value })} />
        <textarea aria-label="批量操作原因" required placeholder="说明版本、地图或英雄发生了什么变化" value={bulk.reason} onChange={(event) => setBulk({ ...bulk, reason: event.target.value })} />
        <button>批量标记可能失效</button>
      </form>
      {bulkFeedback.error && <p className="form-feedback form-feedback--error" role="alert">{bulkFeedback.error}</p>}
      {bulkFeedback.message && <p className="form-feedback form-feedback--success" role="status">{bulkFeedback.message}</p>}
    </section>}
    <AdminActionDialog
      open={Boolean(dialog)} title={dialog?.title} dangerous={dialog?.dangerous}
      fields={dialog?.kind === 'metadata' ? [{ name: 'game_id', label: '游戏 ID', required: true, value: dialog.item.game?.id }, { name: 'map_id', label: '地图 ID', required: true, value: dialog.item.map?.id }, { name: 'hero_id', label: '英雄 ID', required: true, value: dialog.item.hero?.id }, { name: 'category', label: '点位分类', type: 'select', required: true, value: dialog.item.category, options: [{ value: 'deployment_position', label: '炮台与部署点位' }, { value: 'skill_throw', label: '技能投掷' }, { value: 'timed_throw', label: '开局定时投掷' }, { value: 'hold_position', label: '架枪与站位' }, { value: 'movement_route', label: '位移与路线' }, { value: 'map_interaction', label: '地图机制与交互' }, { value: 'other', label: '其他点位' }] }, reasonField] : dialog?.kind === 'validity' ? [{ name: 'validity_status', label: '有效状态', type: 'select', required: true, value: dialog.item.validity_status, options: [{ value: 'unverified', label: '未验证' }, { value: 'valid', label: '当前有效' }, { value: 'possibly_invalid', label: '可能失效' }, { value: 'invalid', label: '已失效' }] }, reasonField] : [...(dialog?.kind === 'hide' || dialog?.dangerous ? [reasonField] : []), ...(dialog?.dangerous ? [{ name: 'confirm_text', label: '输入 DELETE 确认删除', required: true }] : [])]}
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
  const [form, setForm] = useState(() => ({
    name_zh: item?.name_zh || '',
    name_en: item?.name_en || '',
    aliases: (item?.aliases || []).join(','),
    description: item?.description || '',
    current_version: item?.current_version || '',
    role: item?.role || '',
    status: item?.status || 'active',
    map_type: item?.map_type || '',
    current_status: item?.current_status || 'active',
    icon_media_id: undefined,
    cover_media_id: undefined,
    avatar_media_id: undefined,
  }))
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
    const base = {
      name_zh: nameZh,
      name_en: nameEn || null,
      aliases: form.aliases.split(',').map((value) => value.trim()).filter(Boolean),
      description: form.description.trim() || null,
    }
    let savedItem
    if (type === 'game') {
      const payload = { ...base, current_version: form.current_version.trim() || null, ...(form.icon_media_id !== undefined ? { icon_media_id: form.icon_media_id } : {}), ...(form.cover_media_id !== undefined ? { cover_media_id: form.cover_media_id } : {}) }
      savedItem = item ? await updateGame(item.id, payload) : await createGame(payload)
    } else {
      if (!game) throw new Error('请先选择所属游戏。')
      const imageKey = type === 'hero' ? 'avatar_media_id' : 'cover_media_id'
      const payload = {
        ...base,
        ...(type === 'hero'
          ? { role: form.role.trim() || null, status: form.status }
          : { map_type: form.map_type.trim() || null, current_status: form.current_status }),
        ...(form[imageKey] !== undefined ? { [imageKey]: form[imageKey] } : {}),
      }
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
    <label>简介（可选）<textarea value={form.description} placeholder="用几句话说明这项目录内容" onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
    {type === 'game' && <label>当前版本（可选）<input value={form.current_version} placeholder="例如 2.15.0" onChange={(event) => setForm((current) => ({ ...current, current_version: event.target.value }))} /></label>}
    {type === 'hero' && <>
      <label>英雄定位 role（可选）<input value={form.role} placeholder="例如 support" onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))} /></label>
      <label>英雄状态<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="active">可用</option><option value="inactive">停用</option></select></label>
    </>}
    {type === 'map' && <>
      <label>地图类型 map_type（可选）<input value={form.map_type} placeholder="例如 hybrid" onChange={(event) => setForm((current) => ({ ...current, map_type: event.target.value }))} /></label>
      <label>地图状态<select value={form.current_status} onChange={(event) => setForm((current) => ({ ...current, current_status: event.target.value }))}><option value="active">当前可用</option><option value="rotated_out">暂时轮换外</option><option value="retired">已退役</option></select></label>
    </>}
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
  const [statusAction, setStatusAction] = useState({ gameId: null, messages: [] })
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
  const changeGameStatus = async (game, nextStatus) => {
    setStatusAction({ gameId: game.id, messages: [] })
    try {
      await updateGame(game.id, { status: nextStatus })
      setStatusAction({ gameId: null, messages: [] })
      reloadGames()
      if (selectedGameId === game.id) reloadSelectedGame()
    } catch (requestError) {
      const messages = requestError.details?.map((detail) => detail.message).filter(Boolean)
      setStatusAction({ gameId: game.id, messages: messages?.length ? messages : [requestError.message] })
    }
  }
  const gameStatusControls = (game) => <>
    <button
      className={game.status === 'inactive' ? 'button button--primary' : ''}
      disabled={statusAction.gameId === game.id}
      onClick={() => void changeGameStatus(game, game.status === 'active' ? 'inactive' : 'active')}
      type="button"
    >
      {statusAction.gameId === game.id ? '正在保存…' : game.status === 'active' ? '停用游戏' : '启用游戏'}
    </button>
  </>
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
        <div className="admin-game-card__cover">{game.cover_thumbnail_url || game.cover_url ? <img src={game.cover_thumbnail_url || game.cover_url} alt={`${game.name_zh}封面`} /> : <span aria-hidden="true">游戏封面</span>}</div>
        <div className="admin-game-card__content">
          <div className="admin-game-card__heading">
            <div className="admin-game-card__media">{game.icon_thumbnail_url || game.icon_url ? <img src={game.icon_thumbnail_url || game.icon_url} alt="" /> : <span aria-hidden="true">映</span>}</div>
            <div className="admin-game-card__identity"><strong>{game.name_zh}</strong>{game.name_en && <small>{game.name_en}</small>}<span>{game.current_version || '未标注版本'}</span></div>
            <span className={`admin-catalog-status admin-catalog-status--${game.status}`}>{game.status === 'active' ? '已启用' : '未启用'}</span>
          </div>
          <p className="admin-game-card__description">{game.description || '还没有填写游戏简介。'}</p>
          <div className="admin-game-card__meta"><span>{game.active_hero_count ?? game.hero_count} 位英雄</span><span>{game.usable_map_count ?? game.map_count} 张地图</span><span>{game.guide_count || 0} 个点位</span></div>
          <div className={`admin-catalog-readiness ${game.catalog_ready ? 'is-ready' : 'is-blocked'}`}>
            <strong>{game.catalog_ready ? '目录已准备完成' : '目录尚未准备完成'}</strong>
            {!game.catalog_ready && <ul>{(game.catalog_issues || []).map((issue) => <li key={issue}>{issue}</li>)}</ul>}
          </div>
          {statusAction.gameId === game.id && statusAction.messages.length > 0 && <div className="form-feedback form-feedback--error" role="alert">{statusAction.messages.map((message) => <p key={message}>{message}</p>)}</div>}
          <div className="admin-game-card__actions"><button onClick={() => openEditor('game', game)} type="button">编辑游戏</button>{gameStatusControls(game)}<button className="button button--primary" onClick={() => openGame(game.id)} type="button">管理游戏目录</button></div>
        </div>
      </article>)}
    </div> : <p className="state-message">还没有游戏目录。创建第一款游戏后，再为它补充地图和英雄。</p>)}</State>
  </section>

  if (selectedGameState.loading) return <section className="admin-page admin-game-workspace"><p className="state-message">正在加载游戏目录…</p></section>
  if (selectedGameState.error) return <section className="admin-page admin-game-workspace"><p className="state-message state-message--error">{selectedGameState.error.message}</p><button className="admin-game-workspace__back" onClick={closeWorkspace}>返回游戏目录</button></section>
  if (!selectedGame) return <section className="admin-page admin-game-workspace"><p className="state-message">没有找到该游戏。</p><button className="admin-game-workspace__back" onClick={closeWorkspace}>返回游戏目录</button></section>

  return <section className="admin-page admin-game-workspace">
    <button className="admin-game-workspace__back" onClick={closeWorkspace}>返回游戏目录</button>
    <header className="admin-game-header">
      <div className="admin-game-header__cover">{selectedGame.cover_thumbnail_url || selectedGame.cover_url ? <img src={selectedGame.cover_thumbnail_url || selectedGame.cover_url} alt={`${selectedGame.name_zh}封面`} /> : <span aria-hidden="true">游戏目录</span>}</div>
      <div className="admin-game-header__body">
        <div className="admin-game-header__identity">
          <div className="admin-game-header__icon">{selectedGame.icon_thumbnail_url || selectedGame.icon_url ? <img src={selectedGame.icon_thumbnail_url || selectedGame.icon_url} alt="" /> : <span aria-hidden="true">映</span>}</div>
          <div className="admin-game-header__meta"><p>当前正在管理：{selectedGame.name_zh}</p><h2>{selectedGame.name_zh}</h2>{selectedGame.name_en && <span>{selectedGame.name_en}</span>}<small>{selectedGame.current_version || '未标注版本'} · {selectedGame.status === 'active' ? '已启用' : '未启用'} · {selectedGame.active_hero_count ?? selectedGame.hero_count} 位英雄 · {selectedGame.usable_map_count ?? selectedGame.map_count} 张地图 · {selectedGame.guide_count || 0} 个点位</small></div>
        </div>
        <div className="admin-game-header__actions"><button onClick={() => openEditor('game', selectedGame)} type="button">编辑游戏</button>{gameStatusControls(selectedGame)}</div>
        {statusAction.gameId === selectedGame.id && statusAction.messages.length > 0 && <div className="form-feedback form-feedback--error" role="alert">{statusAction.messages.map((message) => <p key={message}>{message}</p>)}</div>}
      </div>
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
          <div className="admin-catalog-item__body"><strong>{item.name_zh}</strong>{item.name_en && <small>{item.name_en}</small>}<span>{section === 'heroes' ? item.role || '未标注定位' : item.map_type || '未标注类型'}</span><small>关联历史点位 {item.guide_count || 0} 个</small>{item.guide_count > 0 && (section === 'heroes' ? item.status === 'inactive' : item.current_status === 'retired') && <small className="admin-catalog-item__warning">历史点位仍保留，可在内容管理中批量标记可能失效。</small>}</div>
          <div className="admin-catalog-item__status"><span>{section === 'heroes' ? item.status : item.current_status}</span><span>{item.review_status}</span></div>
          <div className="admin-catalog-item__actions"><button onClick={() => openEditor(sectionType, item)}>编辑</button></div>
        </article>)}
      </div> : <p className="state-message">{section === 'heroes' ? <>这款游戏还没有英雄。添加英雄后，玩家才能发布对应点位。</> : <>这款游戏还没有地图。添加地图后，玩家才能按地图查找点位。</>}</p>)}</State>
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

export { AdminCatalogPage, AdminChaptersPage, AdminContentPage, AdminDashboardPage, AdminLogsPage, AdminReportDetailPage, AdminReportsPage, AdminUserDetailPage, AdminUsersPage, CatalogEditor }
