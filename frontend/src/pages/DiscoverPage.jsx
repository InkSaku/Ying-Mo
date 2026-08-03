/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDiscover } from '../api/discover.js'
import AdaptiveMedia from '../components/common/AdaptiveMedia.jsx'
import { GameCard } from '../components/games/CatalogCards.jsx'
import GuideCard from '../components/guides/GuideCard.jsx'
import LifePostCard from '../components/life/LifePostCard.jsx'
import MasonryFeed from '../components/layout/MasonryFeed.jsx'

function Section({ title, to, children, empty }) {
  return (
    <section className="discover-section">
      <div className="discover-section__heading">
        <h2>{title}</h2>
        <Link className="text-link" to={to}>查看全部</Link>
      </div>
      {empty ? <p className="life-empty">这里暂时没有内容。</p> : children}
    </section>
  )
}

function FeaturedCard({ item }) {
  if (item.target_type === 'life_post') {
    return <LifePostCard post={item.content} />
  }

  return <GuideCard guide={item.content} />
}

export default function DiscoverPage() {
  const [state, setState] = useState({ loading: true, data: null, error: null })
  const load = useCallback(() => {
    setState({ loading: true, data: null, error: null })
    getDiscover()
      .then((data) => setState({ loading: false, data, error: null }))
      .catch((error) => setState({ loading: false, data: null, error }))
  }, [])

  useEffect(() => { load() }, [load])

  if (state.loading) {
    return <section className="page-container discover-page"><h1>随意走走</h1><p className="state-message">正在翻看新近留下的内容…</p></section>
  }

  if (state.error) {
    return <section className="page-container discover-page"><h1>随意走走</h1><div className="state-message state-message--error"><p>{state.error.message}</p><button onClick={load}>重新加载</button></div></section>
  }

  const data = state.data

  return (
    <section className="page-container discover-page">
      <header>
        <p className="eyebrow">沿着时间与人群浏览</p>
        <h1>随意走走，看看新近留下的光</h1>
        <p>这里没有猜测你会喜欢什么，只把公开的日常、点位与创作者依次铺开。</p>
        <Link className="button" to="/search">找一段日常或一个点位</Link>
      </header>

      <Section title="认真挑出的几笔" to="/discover" empty={!data.featured_content?.length}>
        <MasonryFeed ariaLabel="编辑精选内容">
          {data.featured_content?.map((item) => (
            <FeaturedCard key={`${item.target_type}-${item.content.id}`} item={item} />
          ))}
        </MasonryFeed>
      </Section>

      <Section title="刚刚写下的日常" to="/life" empty={!data.latest_life_posts.length}>
        <MasonryFeed ariaLabel="最新日常">
          {data.latest_life_posts.map((item) => (
            <LifePostCard key={item.id} post={item} />
          ))}
        </MasonryFeed>
      </Section>

      <Section title="许多人走过的章节" to="/life/chapters" empty={!data.popular_life_chapters.length}>
        <div className="chapter-grid">
          {data.popular_life_chapters.map((item) => (
            <Link className="chapter-card" key={item.id} to={`/life/chapter/${item.slug}`}>
              <span className="discover-chapter-card__media">
                {item.cover_thumbnail_url
                  ? <AdaptiveMedia src={item.cover_thumbnail_url} alt="" fit="contain" />
                  : <span aria-hidden="true">映</span>}
              </span>
              <h3>{item.name}</h3>
              <p>{item.description || item.chapter_type}</p>
              <small>{item.content_count} 条内容 · {item.contributor_count} 位参与者</small>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="新近留下的点位" to="/guides" empty={!data.latest_guides.length}>
        <div className="discover-card-grid">
          {data.latest_guides.map((item) => (
            <GuideCard key={item.id} guide={item} />
          ))}
        </div>
      </Section>

      <Section title="最近常去的战场" to="/games" empty={!data.popular_games.length}>
        <div className="discover-card-grid">
          {data.popular_games.map((item) => <GameCard key={item.id} game={item} />)}
        </div>
      </Section>

      <Section title="仍在写、仍在分享的人" to="/search?scope=user" empty={!data.active_creators.length}>
        <div className="creator-grid">
          {data.active_creators.map((item) => (
            <Link key={item.username} className="creator-card" to={`/user/${item.username}`}>
              {item.avatar_url
                ? <img src={item.avatar_url} alt="" />
                : <span>{item.nickname.slice(0, 1)}</span>}
              <div>
                <strong>{item.nickname}</strong>
                <small>@{item.username}</small>
              </div>
            </Link>
          ))}
        </div>
      </Section>
    </section>
  )
}
