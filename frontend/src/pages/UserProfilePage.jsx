/* eslint-disable react-hooks/set-state-in-effect */
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getPublicUser, getPublicUserGuides, getPublicUserLifePosts } from '../api/users.js'
import { useAuth } from '../auth/useAuth.js'
import { ProfileGuideCard, ProfileLifeCard } from '../components/profile/ProfileContentCards.jsx'
import ProfileContentToolbar from '../components/profile/ProfileContentToolbar.jsx'
import PublicProfileHero from '../components/profile/PublicProfileHero.jsx'
import {
  ProfileContentSkeleton,
  ProfileEmptyState,
  ProfileHeroSkeleton,
  ProfileNotFound,
} from '../components/profile/ProfileStates.jsx'
import Pagination from '../components/life/Pagination.jsx'

function getErrorStatus(error) {
  return error?.response?.status || error?.status
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.message || fallback
}

function normalizePage(value) {
  const page = Number(value || 1)
  return Number.isInteger(page) && page > 0 ? page : 1
}

export default function UserProfilePage() {
  const { username = '' } = useParams()
  return <Profile key={username} username={username} />
}

function Profile({ username }) {
  const { user } = useAuth()
  const reducedMotion = useReducedMotion()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'guides' ? 'guides' : 'posts'
  const sort = params.get('sort') === 'updated' ? 'updated' : 'latest'
  const page = normalizePage(params.get('page'))
  const [profile, setProfile] = useState({ loading: true, data: null, error: null })
  const [content, setContent] = useState({ loading: true, data: [], meta: null, error: null })

  useEffect(() => {
    let cancelled = false

    setProfile({ loading: true, data: null, error: null })
    getPublicUser(username)
      .then((data) => !cancelled && setProfile({ loading: false, data, error: null }))
      .catch((error) => !cancelled && setProfile({ loading: false, data: null, error }))

    return () => { cancelled = true }
  }, [username])

  useEffect(() => {
    let cancelled = false
    const fetcher = tab === 'posts' ? getPublicUserLifePosts : getPublicUserGuides

    setContent({ loading: true, data: [], meta: null, error: null })
    fetcher(username, { page, page_size: 12, sort })
      .then((result) => !cancelled && setContent({ loading: false, data: result.data, meta: result.meta, error: null }))
      .catch((error) => !cancelled && setContent({ loading: false, data: [], meta: null, error }))

    return () => { cancelled = true }
  }, [username, tab, sort, page])

  if (profile.loading) return <ProfileHeroSkeleton />
  if (getErrorStatus(profile.error) === 404) return <ProfileNotFound />
  if (profile.error) {
    return (
      <section className="public-profile-page page-container">
        <div className="profile-missing-state profile-missing-state--error">
          <p className="eyebrow">资料加载失败</p>
          <h1>暂时无法打开这个主页</h1>
          <p>{getErrorMessage(profile.error, '请稍后再试。')}</p>
          <Link className="button" to="/">返回首页</Link>
        </div>
      </section>
    )
  }

  const data = profile.data
  const self = user?.username?.toLowerCase() === data.username.toLowerCase()
  const pagination = content.meta?.pagination
  const total = pagination?.total

  const updateParams = (next) => {
    const nextParams = new URLSearchParams()
    nextParams.set('tab', next.tab ?? tab)
    nextParams.set('sort', next.sort ?? sort)
    const nextPage = next.page ?? 1
    if (nextPage > 1) nextParams.set('page', String(nextPage))
    setParams(nextParams)
  }

  return (
    <section className="public-profile-page page-container">
      <PublicProfileHero profile={data} self={self} reducedMotion={reducedMotion} />

      <motion.section
        className="profile-content-section"
        aria-labelledby="profile-content-title"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34, delay: reducedMotion ? 0 : 0.12, ease: [0.22, 1, 0.36, 1] }}
      >
        <ProfileContentToolbar
          tab={tab}
          sort={sort}
          stats={data.stats}
          total={total}
          onTabChange={(nextTab) => updateParams({ tab: nextTab, page: 1 })}
          onSortChange={(nextSort) => updateParams({ sort: nextSort, page: 1 })}
        />

        <AnimatePresence mode="wait" initial={false}>
          {content.loading ? (
            <motion.div
              key={`loading-${tab}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              <ProfileContentSkeleton tab={tab} />
            </motion.div>
          ) : content.error ? (
            <motion.div
              key={`error-${tab}`}
              className="profile-content-error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <strong>内容暂时没有加载出来</strong>
              <p>{getErrorMessage(content.error, '请稍后刷新页面重试。')}</p>
            </motion.div>
          ) : content.data.length ? (
            <motion.div
              key={`${tab}-${sort}-${page}`}
              className={`profile-content-grid profile-content-grid--${tab}`}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              {content.data.map((item, index) => (
                tab === 'posts' ? (
                  <ProfileLifeCard key={item.id} post={item} index={index} reducedMotion={reducedMotion} />
                ) : (
                  <ProfileGuideCard key={item.id} guide={item} index={index} reducedMotion={reducedMotion} />
                )
              ))}
            </motion.div>
          ) : (
            <motion.div
              key={`empty-${tab}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ProfileEmptyState tab={tab} self={self} />
            </motion.div>
          )}
        </AnimatePresence>

        <Pagination
          pagination={pagination}
          onPageChange={(nextPage) => updateParams({ page: nextPage })}
        />

        <div className="profile-content-discovery">
          <span>看完这页了吗？</span>
          <Link to="/discover">继续浏览社区内容 <span aria-hidden="true">→</span></Link>
        </div>
      </motion.section>
    </section>
  )
}
