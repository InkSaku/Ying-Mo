import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import ReportButton from '../reports/ReportButton.jsx'

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

function joinedAt(value) {
  return value ? dateFormatter.format(new Date(value)) : ''
}

export default function PublicProfileHero({ profile, self, reducedMotion }) {
  const stats = [
    { label: '日常', value: profile.stats.life_post_count, hint: '生活记录' },
    { label: '教材', value: profile.stats.guide_count, hint: '游戏经验' },
    { label: '获赞', value: profile.stats.received_like_count, hint: '收到回应' },
  ]

  const entrance = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } }

  return (
    <motion.article
      className="public-profile-hero"
      {...entrance}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="public-profile-hero__wash public-profile-hero__wash--one" aria-hidden="true" />
      <span className="public-profile-hero__wash public-profile-hero__wash--two" aria-hidden="true" />

      <div className="public-profile-hero__main">
        <motion.div
          className="public-profile-hero__avatar-frame"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.28, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
        >
          {profile.avatar_url ? (
            <img
              className="public-profile-hero__avatar"
              src={profile.avatar_url}
              alt={`${profile.nickname} 的头像`}
            />
          ) : (
            <span className="public-profile-hero__avatar public-profile-hero__avatar--empty" aria-hidden="true">
              {profile.nickname.slice(0, 1)}
            </span>
          )}
        </motion.div>

        <div className="public-profile-hero__copy">
          <div className="public-profile-hero__identity">
            <p className="eyebrow">映墨公开主页</p>
            <h1>{profile.nickname}</h1>
            <p className="public-profile-hero__username">@{profile.username}</p>
          </div>

          <div className="public-profile-hero__meta" aria-label="用户资料摘要">
            {profile.region && <span>来自 {profile.region}</span>}
            {profile.created_at && <span>{joinedAt(profile.created_at)} 加入</span>}
          </div>

          <p className={`public-profile-hero__bio${profile.bio ? '' : ' public-profile-hero__bio--empty'}`}>
            {profile.bio || '这位用户还没有留下简介，先从公开的创作记录认识他。'}
          </p>

          <div className="public-profile-hero__actions">
            {self ? (
              <>
                <Link className="button button--primary" to="/me/settings">编辑资料</Link>
                <Link className="button" to="/me">个人中心</Link>
              </>
            ) : (
              <ReportButton targetType="user" targetId={profile.id} />
            )}
          </div>
        </div>
      </div>

      <dl className="public-profile-stats" aria-label="公开创作统计">
        {stats.map((item, index) => (
          <motion.div
            key={item.label}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: reducedMotion ? 0 : 0.1 + index * 0.045 }}
          >
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
            <span>{item.hint}</span>
          </motion.div>
        ))}
      </dl>
    </motion.article>
  )
}
