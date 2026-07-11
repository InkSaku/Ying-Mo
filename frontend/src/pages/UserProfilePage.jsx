import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPublicUser } from '../api/users.js'
import { useAuth } from '../auth/useAuth.js'

function joinedAt(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value))
}

export default function UserProfilePage() {
  const { username = '' } = useParams()
  return <UserProfileLoader key={username} username={username} />
}

function UserProfileLoader({ username }) {
  const { user } = useAuth()
  const [state, setState] = useState({ loading: true, profile: null, error: null })

  useEffect(() => {
    let cancelled = false
    getPublicUser(username).then((profile) => {
      if (!cancelled) setState({ loading: false, profile, error: null })
    }).catch((error) => {
      if (!cancelled) setState({ loading: false, profile: null, error })
    })
    return () => { cancelled = true }
  }, [username])

  if (state.loading) return <section className="profile-page page-container"><p className="state-message">正在打开这页资料…</p></section>
  if (state.error?.status === 404) return <section className="profile-page page-container"><p className="state-message state-message--error">没有找到这位用户。</p><Link className="button" to="/">返回首页</Link></section>
  if (state.error) return <section className="profile-page page-container"><p className="state-message state-message--error">{state.error.message}</p></section>

  const profile = state.profile
  const isSelf = user?.username.toLowerCase() === profile.username.toLowerCase()
  return (
    <section className="profile-page page-container">
      <article className="public-profile-card">
        {profile.avatar_url ? <img className="public-profile-card__avatar" src={profile.avatar_url} alt={`${profile.nickname} 的头像`} /> : <div className="public-profile-card__avatar public-profile-card__avatar--empty" aria-label="未设置头像">{profile.nickname.slice(0, 1)}</div>}
        <div>
          <p className="eyebrow">映墨用户</p>
          <h1>{profile.nickname}</h1>
          <p className="public-profile-card__username">@{profile.username}</p>
          {profile.bio ? <p className="public-profile-card__bio">{profile.bio}</p> : <p className="public-profile-card__bio public-profile-card__bio--empty">这位用户还没有留下简介。</p>}
          {profile.region && <p>来自 {profile.region}</p>}
          <p className="public-profile-card__joined">加入映墨于 {joinedAt(profile.created_at)}</p>
          {isSelf && <Link className="button button--primary" to="/me/settings">编辑资料</Link>}
        </div>
      </article>
    </section>
  )
}
