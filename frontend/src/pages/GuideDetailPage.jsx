import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteGuide, getGuide, setGuideValidityFeedback } from '../api/guides.js'
import InteractionPanel from '../components/interactions/InteractionPanel.jsx'
import ReportButton from '../components/reports/ReportButton.jsx'
import { categoryLabels, validityLabels } from '../components/guides/guideLabels.js'

function sideLabel(side) {
  return side === 'attack' ? '进攻方' : side === 'defense' ? '防守方' : side === 'both' ? '攻防皆可' : '未指定'
}

function dateLabel(value, withTime = false) {
  if (!value) return '未记录'
  return new Date(value).toLocaleString('zh-CN', withTime ? undefined : { year: 'numeric', month: 'numeric', day: 'numeric' })
}

export default function GuideDetailPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const [state, setState] = useState({ loading: true, data: null, error: null })
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let cancelled = false
    getGuide(id)
      .then((data) => {
        if (!cancelled) setState({ loading: false, data, error: null })
      })
      .catch((error) => {
        if (!cancelled) setState({ loading: false, data: null, error })
      })
    return () => { cancelled = true }
  }, [id])

  if (state.loading) return <section className="guide-detail page-container"><p className="state-message">正在加载点位…</p></section>
  if (state.error) return <section className="guide-detail page-container"><div className="state-message state-message--error" role="alert"><h1>点位加载失败</h1><p>{state.error.message}</p></div></section>

  const guide = state.data
  const back = `/game/${guide.game.slug}/map/${guide.map.slug}/hero/${guide.hero.slug}`
  const catalogUnavailable = [guide.game, guide.map, guide.hero].some((item) => item?.is_available === false)

  async function feedback(type) {
    setPending(true)
    setActionError('')
    try {
      const data = await setGuideValidityFeedback(id, type)
      setState((current) => ({ ...current, data }))
    } catch (error) {
      setActionError(error.message)
    } finally {
      setPending(false)
    }
  }

  async function remove() {
    if (!window.confirm('确认删除这个点位吗？')) return
    setActionError('')
    try {
      await deleteGuide(id)
      nav(back)
    } catch (error) {
      setActionError(error.message)
    }
  }

  return <article className="guide-detail page-container">
    <Link className="text-link" to={back}>返回 {guide.map.name_zh} · {guide.hero.name_zh} 点位列表</Link>
    <header className="guide-detail__header">
      <p className="eyebrow">{guide.game.name_zh} · {guide.map.name_zh} · {guide.hero.name_zh}</p>
      <h1>{guide.title}</h1>
      <p>作者：{guide.author.nickname} · 最近更新：{dateLabel(guide.updated_at, true)}</p>
      {catalogUnavailable && <p className="catalog-warning">关联的游戏、地图或英雄当前不可用于新发布；这个历史点位仍会保留并可继续查看。</p>}
    </header>

    <dl className="guide-meta guide-meta--primary">
      <div><dt>地图</dt><dd>{guide.map.name_zh}</dd></div>
      <div><dt>英雄</dt><dd>{guide.hero.name_zh}</dd></div>
      <div><dt>分类</dt><dd>{categoryLabels[guide.category] || guide.category}</dd></div>
      <div><dt>攻防方</dt><dd>{sideLabel(guide.side)}</dd></div>
      <div><dt>地图区域</dt><dd>{guide.map_area || '未记录'}</dd></div>
      <div><dt>投掷时间 / 时机</dt><dd>{guide.timing || '未记录'}</dd></div>
      <div><dt>游戏版本</dt><dd>{guide.game_version || '未记录'}</dd></div>
      <div><dt>测试日期</dt><dd>{guide.tested_at || '未记录'}</dd></div>
      <div><dt>有效状态</dt><dd><span className={`guide-validity guide-validity--${guide.validity_status}`}>{validityLabels[guide.validity_status] || guide.validity_status}</span></dd></div>
      <div><dt>最近确认</dt><dd>{dateLabel(guide.last_confirmed_at, true)}</dd></div>
    </dl>

    <section className="guide-detail__section">
      <h2>详细说明</h2>
      <p className="guide-detail__instructions">{guide.instructions}</p>
      {guide.skill && <p><strong>技能：</strong>{guide.skill}</p>}
      {guide.aim_reference && <p><strong>瞄准参照物：</strong>{guide.aim_reference}</p>}
    </section>

    {guide.steps.length > 0 && <section className="guide-detail__section">
      <h2>{guide.content_mode === 'steps' ? '分步说明' : '图片说明'}</h2>
      <div className="guide-detail__steps">{guide.steps.map((step, index) => <article className="guide-step-viewer" key={step.id}>
        {step.url && <img src={step.url} alt={step.title || `${guide.title} 图片 ${index + 1}`} loading="lazy" />}
        {step.title && <h3>{step.title}</h3>}
        {step.description && <p>{step.description}</p>}
      </article>)}</div>
    </section>}

    {guide.video_url && <section className="guide-detail__section"><h2>外部视频</h2><a className="button" href={guide.video_url} target="_blank" rel="noreferrer">打开外部视频 ↗</a></section>}
    {guide.notes && <section className="guide-detail__section"><h2>注意事项</h2><p className="guide-detail__instructions">{guide.notes}</p></section>}
    {guide.tags.length > 0 && <div className="tag-row">{guide.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}

    <section className="guide-detail__section guide-feedback">
      <h2>有效性反馈</h2>
      <p>仍有效 {guide.validity_feedback.valid} · 可能失效 {guide.validity_feedback.possibly_invalid}</p>
      {guide.validity_feedback.current_user && <p>你已反馈：{guide.validity_feedback.current_user === 'valid' ? '仍然有效' : '可能失效'}</p>}
      <div className="guide-form__actions">
        <button disabled={pending || guide.validity_feedback.current_user === 'valid'} onClick={() => void feedback('valid')}>{guide.validity_feedback.current_user === 'valid' ? '已反馈仍然有效' : '仍然有效'}</button>
        <button disabled={pending || guide.validity_feedback.current_user === 'possibly_invalid'} onClick={() => void feedback('possibly_invalid')}>{guide.validity_feedback.current_user === 'possibly_invalid' ? '已反馈可能失效' : '可能失效'}</button>
      </div>
    </section>

    {actionError && <p className="form-feedback form-feedback--error" role="alert">{actionError}</p>}
    <div className="life-toolbar">
      {guide.can_edit && <Link className="button" to={`/guide/${guide.id}/edit`}>编辑点位</Link>}
      {guide.can_delete && <button className="button--danger" onClick={() => void remove()}>删除点位</button>}
      <ReportButton targetType="game_guide" targetId={guide.id} />
    </div>
    <InteractionPanel targetType="game_guide" targetId={guide.id} />
  </article>
}
