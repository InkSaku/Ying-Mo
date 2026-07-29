import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { createComment, deleteComment, getCommentReplies, getComments } from '../../api/comments.js'
import { useAuth } from '../../auth/useAuth.js'
import {
  favoriteTarget,
  getInteractionSummary,
  likeTarget,
  unfavoriteTarget,
  unlikeTarget,
} from '../../api/interactions.js'
import ReportButton from '../reports/ReportButton.jsx'

export default function InteractionPanel({ targetType, targetId, animated = false }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const reducedMotion = useReducedMotion()
  const commentListRef = useRef(null)
  const [summary, setSummary] = useState(null)
  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [freshCommentId, setFreshCommentId] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setCommentsLoading(true)
    try {
      const [nextSummary, result] = await Promise.all([
        getInteractionSummary(targetType, targetId),
        getComments({ target_type: targetType, target_id: targetId, page_size: 20 }),
      ])
      setSummary(nextSummary)
      setComments(result.data)
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setCommentsLoading(false)
    }
  }, [targetType, targetId])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    if (!freshCommentId) return undefined
    const revealTimer = window.setTimeout(() => {
      const comment = commentListRef.current?.querySelector(`[data-comment-id="${freshCommentId}"]`)
      comment?.scrollIntoView?.({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'nearest',
      })
    }, 40)
    const clearTimer = window.setTimeout(() => setFreshCommentId(null), 1800)
    return () => {
      window.clearTimeout(revealTimer)
      window.clearTimeout(clearTimer)
    }
  }, [freshCommentId, reducedMotion])

  function requireLogin() {
    if (auth.isAuthenticated) return true
    navigate(`/login?next=${encodeURIComponent(location.pathname)}`)
    return false
  }

  async function toggle(kind) {
    if (!requireLogin() || busy || !summary) return
    setBusy(kind)
    try {
      if (kind === 'like') {
        const action = summary.viewer.liked ? unlikeTarget : likeTarget
        setSummary(await action(targetType, targetId))
      } else {
        const action = summary.viewer.favorited ? unfavoriteTarget : favoriteTarget
        const result = await action(targetType, targetId)
        setSummary((current) => ({
          ...current,
          viewer: { ...current.viewer, favorited: result.favorited },
        }))
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy('')
    }
  }

  async function submit(event) {
    event.preventDefault()
    if (!requireLogin() || busy || !body.trim()) return
    setBusy('comment')
    try {
      const created = await createComment({
        target_type: targetType,
        target_id: Number(targetId),
        body: body.trim(),
        reply_to_comment_id: replyTo?.id || null,
      })
      setBody('')
      setReplyTo(null)
      setFreshCommentId(created.id)
      await load({ silent: true })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy('')
    }
  }

  async function remove(id) {
    try {
      await deleteComment(id)
      await load({ silent: true })
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function more(item) {
    try {
      const result = await getCommentReplies(item.id, { page_size: 100 })
      setComments((all) => all.map((comment) => (
        comment.id === item.id ? { ...comment, replies: result.data } : comment
      )))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const motionEnabled = animated && !reducedMotion

  return (
    <section className={`interaction-panel${animated ? ' interaction-panel--immersive' : ''}`} aria-label="内容互动">
      <div className="interaction-bar">
        <button type="button" aria-label="点赞" aria-pressed={summary?.viewer.liked || false} disabled={!!busy} onClick={() => void toggle('like')}>
          ♡ {summary?.like_count ?? '—'}
        </button>
        <button type="button" aria-label="收藏" aria-pressed={summary?.viewer.favorited || false} disabled={!!busy} onClick={() => void toggle('favorite')}>
          ☆ {summary?.viewer.favorited ? '已收藏' : '收藏'}
        </button>
        <span>评论 {summary?.comment_count ?? '—'}</span>
      </div>

      <div className="interaction-panel__heading">
        <div>
          <p className="eyebrow">一起回应这段生活</p>
          <h2>评论</h2>
        </div>
        {!commentsLoading && <span>{comments.length ? `${comments.length} 条讨论` : '等待第一条留言'}</span>}
      </div>

      {auth.isAuthenticated && !auth.user.can_comment ? (
        <p>当前账号暂时不能发表评论。</p>
      ) : (
        <form className="comment-composer" onSubmit={submit}>
          <AnimatePresence initial={false}>
            {replyTo && (
              <motion.p
                className="comment-composer__replying"
                initial={motionEnabled ? { opacity: 0, y: -5 } : false}
                animate={{ opacity: 1, y: 0 }}
                exit={motionEnabled ? { opacity: 0, y: -5 } : undefined}
              >
                回复 @{replyTo.author.nickname}
                <button type="button" onClick={() => setReplyTo(null)}>取消</button>
              </motion.p>
            )}
          </AnimatePresence>
          <textarea
            maxLength="500"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={auth.isAuthenticated ? '写下友善、具体的评论…' : '登录后参与评论'}
            disabled={!auth.isAuthenticated || !auth.user?.can_comment}
          />
          <div>
            <span>{body.length}/500</span>
            <button disabled={busy === 'comment' || !body.trim()}>
              {busy === 'comment' ? '发布中…' : '发布'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="form-feedback form-feedback--error" role="alert">
          {error} <button type="button" onClick={() => void load()}>重试</button>
        </p>
      )}

      <div ref={commentListRef} aria-live="polite">
        <AnimatePresence initial={motionEnabled} mode="popLayout">
          {commentsLoading ? (
            <motion.div className="comment-list__loading" key="loading" exit={motionEnabled ? { opacity: 0 } : undefined}>
              <i /><i /><i />
              <span className="sr-only">正在整理评论…</span>
            </motion.div>
          ) : comments.length === 0 ? (
            <motion.p
              className="state-message"
              key="empty"
              initial={motionEnabled ? { opacity: 0, y: 6 } : false}
              animate={{ opacity: 1, y: 0 }}
            >
              还没有评论，来写第一条吧。
            </motion.p>
          ) : (
            <motion.div className="comment-list" key="comments">
              <AnimatePresence initial={motionEnabled} mode="popLayout">
                {comments.map((item, itemIndex) => (
                  <Comment
                    key={item.id}
                    item={item}
                    index={itemIndex}
                    animated={motionEnabled}
                    freshCommentId={freshCommentId}
                    onReply={setReplyTo}
                    onDelete={remove}
                    onMore={more}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}

function Comment({
  item,
  index,
  animated,
  freshCommentId,
  onReply,
  onDelete,
  onMore,
}) {
  const isFresh = item.id === freshCommentId

  return (
    <motion.article
      className={`comment${item.is_reply ? ' comment--reply' : ''}${isFresh ? ' comment--fresh' : ''}`}
      data-comment-id={item.id}
      layout={animated ? 'position' : false}
      initial={animated ? { opacity: 0, y: isFresh ? 16 : 9, scale: isFresh ? 0.985 : 1 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={animated ? { opacity: 0, y: -6, scale: 0.99 } : undefined}
      transition={{
        duration: animated ? 0.32 : 0,
        delay: animated ? Math.min(index * 0.045, 0.18) : 0,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <header>
        <strong>{item.author.nickname}</strong>
        <time>{new Date(item.created_at).toLocaleString('zh-CN')}</time>
      </header>
      <p className={item.is_deleted ? 'comment__deleted' : ''}>
        {item.is_deleted ? '该评论已删除' : (
          <>
            {item.reply_to_user && <span>回复 @{item.reply_to_user.nickname}：</span>}
            {item.body}
          </>
        )}
      </p>
      {!item.is_deleted && (
        <div className="comment__actions">
          <button type="button" onClick={() => onReply(item)}>回复</button>
          {item.can_delete && <button type="button" onClick={() => void onDelete(item.id)}>删除</button>}
          <ReportButton targetType="comment" targetId={item.id} />
        </div>
      )}
      <AnimatePresence initial={animated}>
        {item.replies?.map((reply, replyIndex) => (
          <Comment
            key={reply.id}
            item={reply}
            index={replyIndex}
            animated={animated}
            freshCommentId={freshCommentId}
            onReply={onReply}
            onDelete={onDelete}
            onMore={onMore}
          />
        ))}
      </AnimatePresence>
      {item.reply_count > (item.replies?.length || 0) && (
        <button type="button" onClick={() => void onMore(item)}>
          加载全部 {item.reply_count} 条回复
        </button>
      )}
    </motion.article>
  )
}
