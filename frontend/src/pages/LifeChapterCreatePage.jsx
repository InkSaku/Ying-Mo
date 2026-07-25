import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { createLifeChapter, updateLifeChapter } from '../api/life.js'
import { getMyChapter } from '../api/users.js'
import ChapterEditorForm from '../components/life/ChapterEditorForm.jsx'

export default function LifeChapterCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const resubmitId = searchParams.get('resubmit')
  const [initial, setInitial] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)
  const numericResubmitId = resubmitId ? Number(resubmitId) : null
  const invalidResubmitId = Boolean(resubmitId && (!Number.isInteger(numericResubmitId) || numericResubmitId <= 0))

  useEffect(() => {
    if (!resubmitId || invalidResubmitId) return undefined
    let cancelled = false
    getMyChapter(numericResubmitId).then((chapter) => {
      if (!cancelled) setInitial(chapter)
    }).catch((requestError) => {
      if (!cancelled) setLoadError(requestError)
    })
    return () => { cancelled = true }
  }, [invalidResubmitId, numericResubmitId, resubmitId])

  async function submit(payload) {
    setPending(true)
    setError(null)
    try {
      const chapter = resubmitId
        ? await updateLifeChapter(numericResubmitId, payload)
        : await createLifeChapter(payload)
      if (chapter.review_status === 'approved') navigate(`/life/chapter/${chapter.slug}`)
      else navigate('/me/chapters')
    } catch (requestError) {
      setError(requestError)
      throw requestError
    } finally {
      setPending(false)
    }
  }

  if (invalidResubmitId) return <section className="life-page page-container"><p className="form-feedback form-feedback--error">章节编号不合法。</p></section>
  if (resubmitId && !initial && !loadError) return <section className="life-page page-container"><p>正在加载章节…</p></section>
  if (loadError) return <section className="life-page page-container"><p className="form-feedback form-feedback--error">{loadError.message}</p></section>

  return (
    <section className="life-page page-container">
      <Link className="text-link" to={resubmitId ? '/me/chapters' : '/life/chapters'}>返回{resubmitId ? '我的章节' : '章节列表'}</Link>
      <p className="eyebrow">生活章节</p>
      <h1>{resubmitId ? `编辑「${initial.name}」` : '创建生活章节'}</h1>
      <p>章节可以公开浏览。选择“私有”只限制投稿者，不会把章节藏起来。</p>
      <ChapterEditorForm initial={initial} pending={pending} requestError={error} submitLabel={resubmitId ? '保存并重新提交' : '创建章节'} onSubmit={submit} />
    </section>
  )
}
