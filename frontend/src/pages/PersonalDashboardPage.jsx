/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMySummary } from '../api/users.js'

export default function PersonalDashboardPage() {
  const [state, setState] = useState({ loading: true, data: null, error: null }); const load = useCallback(() => { setState({ loading: true, data: null, error: null }); getMySummary().then((data) => setState({ loading: false, data, error: null })).catch((error) => setState({ loading: false, data: null, error })) }, []); useEffect(() => { load() }, [load])
  if (state.loading) return <p className="state-message">正在整理你的内容…</p>; if (state.error) return <div className="state-message state-message--error"><p>{state.error.message}</p><button onClick={load}>重新加载</button></div>
  const data = state.data; const stats = [['日常', data.life_post_count, '/me/posts'], ['点位', data.guide_count, '/me/guides'], ['草稿', data.draft_count, '/me/drafts'], ['已下架', data.hidden_count, '/me/hidden'], ['收藏', data.favorite_count, '/me/favorites'], ['评论', data.comment_count, '/me/comments'], ['获赞', data.received_like_count, '/notifications']]
  return <div className="dashboard"><div className="dashboard__stats">{stats.map(([label, count, to]) => <Link key={label} to={to}><strong>{count}</strong><span>{label}</span></Link>)}</div><div className="dashboard__actions"><Link className="button button--primary" to="/life/create">写一段日常</Link><Link className="button" to="/guide/create">留一处点位</Link></div><section><h2>最近留下的</h2>{data.recent_content.length ? <ul className="dashboard__list">{data.recent_content.map((item) => <li key={`${item.id}-${item.title}`}><Link to={item.game ? `/guide/${item.id}` : `/life/post/${item.id}`}>{item.title}</Link></li>)}</ul> : <p className="life-empty">这里还没有落下第一笔。</p>}</section><section><h2>写了一半的</h2>{data.recent_drafts.length ? <ul className="dashboard__list">{data.recent_drafts.map((item) => <li key={item.id}><Link to={item.draft_type === 'life_post' ? `/life/create?draft=${item.id}` : `/guide/create?draft=${item.id}`}>{item.title}</Link></li>)}</ul> : <p className="life-empty">暂时没有未写完的草稿。</p>}</section></div>
}
