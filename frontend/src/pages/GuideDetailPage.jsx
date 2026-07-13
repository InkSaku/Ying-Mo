import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteGuide, getGuide } from '../api/guides.js'
import InteractionPanel from '../components/interactions/InteractionPanel.jsx'
import ReportButton from '../components/reports/ReportButton.jsx'

export default function GuideDetailPage() {
  const { id } = useParams(); const nav = useNavigate()
  const [state, setState] = useState({ loading: true, data: null, error: null }); const [deleting, setDeleting] = useState(false)
  useEffect(() => { let stop = false; getGuide(id).then((data) => !stop && setState({ loading: false, data, error: null })).catch((error) => !stop && setState({ loading: false, data: null, error })); return () => { stop = true } }, [id])
  async function remove() { if (!state.data || !window.confirm('确认删除这篇教材吗？') || deleting) return; setDeleting(true); try { await deleteGuide(id); nav('/guides') } catch (error) { setState((current) => ({ ...current, error })); setDeleting(false) } }
  if (state.loading) return <section className="guides-page page-container"><p className="state-message">正在加载教材…</p></section>
  if (state.error && !state.data) return <section className="guides-page page-container"><p className="state-message state-message--error">{state.error.status === 404 ? '没有找到这篇教材。' : state.error.message}</p></section>
  const guide = state.data
  return <article className="guide-detail page-container"><Link className="text-link" to="/guides">返回教材列表</Link><p className="eyebrow">{guide.game.name_zh}{guide.hero ? ` · ${guide.hero.name_zh}` : ''}{guide.map ? ` · ${guide.map.name_zh}` : ''}</p><h1>{guide.title}</h1><p>作者 <Link to={`/user/${guide.author.username}`}>{guide.author.nickname}</Link> · {guide.game_version || '版本未标注'}</p><p className="guide-detail__instructions">{guide.instructions}</p><div className="tag-row">{guide.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div><section><h2>完整步骤</h2>{guide.steps.map((step) => <article className="guide-step-viewer" key={step.id}><p className="eyebrow">步骤 {step.position + 1}</p><h3>{step.title}</h3><img src={step.url} alt={`${guide.title}：${step.title}`} loading="lazy" /><p>{step.description}</p></article>)}</section><div className="life-toolbar">{guide.can_edit && <><Link className="button" to={`/guide/${guide.id}/edit`}>编辑教材</Link><button className="button--danger" disabled={deleting} onClick={() => void remove()}>{deleting ? '正在删除…' : '删除教材'}</button></>}<ReportButton targetType="game_guide" targetId={guide.id} /></div><InteractionPanel targetType="game_guide" targetId={guide.id} /></article>
}
