/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDiscover } from '../api/discover.js'
import { GameCard } from '../components/games/CatalogCards.jsx'
import GuideCard from '../components/guides/GuideCard.jsx'
import LifePostCard from '../components/life/LifePostCard.jsx'

function Section({ title, to, children, empty }) {
  return <section className="discover-section"><div className="discover-section__heading"><h2>{title}</h2><Link className="text-link" to={to}>查看全部</Link></div>{empty ? <p className="life-empty">这里暂时没有内容。</p> : children}</section>
}

export default function DiscoverPage() {
  const [state, setState] = useState({ loading: true, data: null, error: null })
  const load = useCallback(() => { setState({ loading: true, data: null, error: null }); getDiscover().then((data) => setState({ loading: false, data, error: null })).catch((error) => setState({ loading: false, data: null, error })) }, [])
  useEffect(() => { load() }, [load])
  if (state.loading) return <section className="page-container discover-page"><h1>发现</h1><p className="state-message">正在整理新的映墨内容…</p></section>
  if (state.error) return <section className="page-container discover-page"><h1>发现</h1><div className="state-message state-message--error"><p>{state.error.message}</p><button onClick={load}>重新加载</button></div></section>
  const data = state.data
  return <section className="page-container discover-page"><header><p className="eyebrow">非个性化内容目录</p><h1>发现正在发生的事</h1><p>按时间与公开互动整理，轻轻看看别人留下的日常与技巧。</p><Link className="button" to="/search">搜索映墨内容</Link></header><Section title="编辑精选" to="/discover" empty={!data.featured_content?.length}><div className="card-grid card-grid--three">{data.featured_content?.map((item) => item.target_type === 'life_post' ? <LifePostCard key={`${item.target_type}-${item.content.id}`} post={item.content} /> : <GuideCard key={`${item.target_type}-${item.content.id}`} guide={item.content} />)}</div></Section><Section title="最新日常" to="/life" empty={!data.latest_life_posts.length}><div className="card-grid card-grid--three">{data.latest_life_posts.map((item) => <LifePostCard key={item.id} post={item} />)}</div></Section><Section title="热门生活章节" to="/life/chapters" empty={!data.popular_life_chapters.length}><div className="chapter-grid">{data.popular_life_chapters.map((item) => <Link className="chapter-card" key={item.id} to={`/life/chapter/${item.slug}`}>{item.cover_thumbnail_url && <img src={item.cover_thumbnail_url} alt="" loading="lazy" />}<h3>{item.name}</h3><p>{item.description || item.chapter_type}</p><small>{item.content_count} 条内容 · {item.contributor_count} 位参与者</small></Link>)}</div></Section><Section title="最新教材" to="/guides" empty={!data.latest_guides.length}><div className="guide-grid">{data.latest_guides.map((item) => <GuideCard key={item.id} guide={item} />)}</div></Section><Section title="热门游戏" to="/games" empty={!data.popular_games.length}><div className="game-grid">{data.popular_games.map((item) => <GameCard key={item.id} game={item} />)}</div></Section><Section title="活跃创作者" to="/search?scope=user" empty={!data.active_creators.length}><div className="creator-grid">{data.active_creators.map((item) => <Link key={item.username} className="creator-card" to={`/user/${item.username}`}>{item.avatar_url ? <img src={item.avatar_url} alt="" /> : <span>{item.nickname.slice(0, 1)}</span>}<div><strong>{item.nickname}</strong><small>@{item.username}</small></div></Link>)}</div></Section></section>
}
