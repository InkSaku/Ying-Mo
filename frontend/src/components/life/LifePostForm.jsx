import { useRef, useState } from 'react'
import { hasLifeContent } from '../../utils/lifeContent.js'
import {
  inlineMediaToken,
  removeInlineMediaToken,
  replaceInlineMediaToken,
  splitInlineMediaContent,
  updateInlineMediaAlt,
} from '../../utils/lifeMedia.js'
import AuthenticatedMedia from '../common/AuthenticatedMedia.jsx'
import LifeCollectionPicker from './LifeCollectionPicker.jsx'
import LifeImageManager from './LifeImageManager.jsx'
import MarkdownContent from './MarkdownContent.jsx'

function localDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function defaultForm(chapterId) {
  return {
    title: '',
    body: '',
    content_format: 'markdown',
    external_video_url: '',
    cover_media_id: null,
    chapter_id: chapterId || '',
    location: '',
    mood: '',
    tags: [],
    shot_at: '',
    visibility: 'public',
  }
}

export default function LifePostForm({
  initial,
  selectedCollection,
  collections,
  onCollectionChange,
  onSubmit,
  onSaveDraft,
  protectedMediaIds = [],
  pending,
  requestError,
}) {
  const initialForm = {
    ...defaultForm(selectedCollection?.id),
    ...(initial || {}),
    content_format: 'markdown',
  }
  const [form, setForm] = useState(initialForm)
  const [images, setImages] = useState(() => initial?.images || [])
  const [preview, setPreview] = useState(false)
  const [changingCollection, setChangingCollection] = useState(false)
  const [tag, setTag] = useState('')
  const [localError, setLocalError] = useState(null)
  const [draggingMedia, setDraggingMedia] = useState(false)
  const bodyRef = useRef(null)
  const mediaManagerRef = useRef(null)
  const mediaInsertionRef = useRef(null)
  const fieldErrors = Object.fromEntries((requestError?.details || []).map((item) => [item.field, item.message]))

  function update(field, value) {
    setLocalError(null)
    setForm((current) => ({ ...current, [field]: value }))
  }

  function addTag() {
    const value = tag.trim()
    if (!value) return
    if (value.length > 20 || form.tags.length >= 10 || form.tags.includes(value)) {
      setLocalError('标签最多 10 个、每个不超过 20 字，且不能重复。')
      return
    }
    setForm((current) => ({ ...current, tags: [...current.tags, value] }))
    setTag('')
  }

  function insertMarkdown(kind) {
    const textarea = bodyRef.current
    if (!textarea) return
    const body = form.body || ''
    const start = textarea.selectionStart ?? body.length
    const end = textarea.selectionEnd ?? start
    const selected = body.slice(start, end)
    let insertion = ''
    let selectedStart = start
    let selectedEnd = start

    if (kind === 'heading') {
      const leadingBreak = start > 0 && body[start - 1] !== '\n' ? '\n' : ''
      const content = selected || '小标题'
      insertion = `${leadingBreak}## ${content}`
      selectedStart = start + leadingBreak.length + 3
      selectedEnd = selectedStart + content.length
    } else if (kind === 'bold') {
      const content = selected || '加粗文字'
      insertion = `**${content}**`
      selectedStart = start + 2
      selectedEnd = selectedStart + content.length
    } else if (kind === 'link') {
      const content = selected || '链接文字'
      insertion = `[${content}](https://)`
      selectedStart = start + insertion.length - 9
      selectedEnd = start + insertion.length - 1
    } else if (kind === 'quote') {
      const leadingBreak = start > 0 && body[start - 1] !== '\n' ? '\n' : ''
      const content = selected || '引用内容'
      const quoted = content.split('\n').map((line) => `> ${line}`).join('\n')
      insertion = `${leadingBreak}${quoted}`
      selectedStart = start + insertion.length
      selectedEnd = selectedStart
    } else if (kind === 'code') {
      const content = selected || '代码'
      const block = content.includes('\n')
      insertion = block ? `\`\`\`\n${content}\n\`\`\`` : `\`${content}\``
      selectedStart = start + (block ? 4 : 1)
      selectedEnd = selectedStart + content.length
    }

    const nextBody = `${body.slice(0, start)}${insertion}${body.slice(end)}`
    if (nextBody.length > 50_000) {
      setLocalError('正文不能超过 50000 字。')
      return
    }
    update('body', nextBody)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(selectedStart, selectedEnd)
    })
  }

  function rememberMediaInsertion() {
    const textarea = bodyRef.current
    const bodyLength = (form.body || '').length
    mediaInsertionRef.current = {
      start: textarea?.selectionStart ?? bodyLength,
    }
  }

  function queueMedia(items, mode) {
    if (!items.length) return
    if (mode === 'cover') {
      setForm((current) => ({ ...current, cover_media_id: items[0].id }))
      return
    }
    setForm((current) => {
      const body = current.body || ''
      const requested = mediaInsertionRef.current?.start ?? body.length
      const start = Math.max(0, Math.min(requested, body.length))
      const before = body.slice(0, start)
      const after = body.slice(start)
      const tokens = items.map((item) => inlineMediaToken(item.id, item.alt_text)).join('\n\n')
      const prefix = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''
      const suffix = after && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : ''
      const insertion = `${prefix}${tokens}${suffix}`
      mediaInsertionRef.current = { start: start + insertion.length }
      return { ...current, body: `${before}${insertion}${after}` }
    })
  }

  function resolveMedia(tempId, media) {
    setForm((current) => ({
      ...current,
      body: replaceInlineMediaToken(current.body, tempId, media.public_id),
      cover_media_id: String(current.cover_media_id) === String(tempId)
        ? media.id
        : current.cover_media_id,
    }))
  }

  function removeMedia(item) {
    const publicId = item.public_id || item.id
    setForm((current) => ({
      ...current,
      body: removeInlineMediaToken(current.body, publicId),
      cover_media_id: String(current.cover_media_id) === String(item.id)
        ? null
        : current.cover_media_id,
    }))
  }

  function changeMediaDescription(item, description) {
    const publicId = item.public_id || item.id
    setForm((current) => ({
      ...current,
      body: updateInlineMediaAlt(current.body, publicId, description),
    }))
  }

  function imageFiles(files) {
    return Array.from(files || []).filter((file) => file.type?.startsWith('image/'))
  }

  function pasteImages(event) {
    const directFiles = imageFiles(event.clipboardData?.files)
    const files = directFiles.length
      ? directFiles
      : imageFiles(
          Array.from(event.clipboardData?.items || [])
            .filter((item) => item.kind === 'file')
            .map((item) => item.getAsFile())
            .filter(Boolean),
        )
    if (!files.length) return
    event.preventDefault()
    mediaManagerRef.current?.addImageFiles(files)
  }

  function dropImages(event) {
    const files = imageFiles(event.dataTransfer?.files)
    setDraggingMedia(false)
    if (!files.length) return
    event.preventDefault()
    mediaManagerRef.current?.addImageFiles(files)
  }

  function allowImageDrop(event) {
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDraggingMedia(true)
  }

  function payload() {
    return {
      title: form.title.trim() || null,
      body: form.body?.trim() || null,
      content_format: form.content_format || 'plain',
      external_video_url: form.external_video_url?.trim() || null,
      cover_media_id: Number.isInteger(form.cover_media_id) ? form.cover_media_id : null,
      chapter_id: Number(form.chapter_id),
      location: form.location?.trim() || null,
      mood: form.mood?.trim() || null,
      tags: form.tags,
      shot_at: form.shot_at ? new Date(form.shot_at).toISOString() : null,
      visibility: form.visibility,
      media_ids: images.map((image) => image.id),
    }
  }

  function submit(event) {
    event.preventDefault()
    const mediaIds = images.map((image) => image.id)
    if (!form.chapter_id) return setLocalError('请先选择要发布到的合集。')
    if (!hasLifeContent({ body: form.body, mediaIds, externalVideoUrl: form.external_video_url })) {
      return setLocalError('正文、媒体或外部视频链接至少填写一项。')
    }
    if (form.title.trim().length > 100) return setLocalError('标题不能超过 100 字。')
    if (form.body?.length > 50_000) return setLocalError('正文不能超过 50000 字。')
    if (images.filter((item) => item.media_type === 'live_video').length > 3) return setLocalError('每篇内容最多添加 3 个实况。')
    if (images.length > 9 || images.some((image) => image.uploading || image.processing || image.error || !Number.isInteger(image.id))) {
      return setLocalError('请等待媒体上传和处理完成，并处理失败的项目。')
    }
    onSubmit(payload())
  }

  function saveDraft() {
    if (images.some((image) => image.uploading || image.processing || image.error || !Number.isInteger(image.id))) {
      setLocalError('请等待媒体上传和处理完成，并处理失败的项目。')
      return
    }
    const data = payload()
    const mediaIds = data.media_ids
    delete data.media_ids
    onSaveDraft?.(data, mediaIds)
  }

  const coverCandidates = images.filter((item) => (item.media_type || 'image') === 'image')
  const inlineMediaDetails = Object.fromEntries(
    splitInlineMediaContent(form.body || '')
      .filter((part) => part.type === 'media')
      .map((part) => [part.publicId.toLowerCase(), part.alt]),
  )

  return (
    <form className="life-form life-editor" onSubmit={submit} noValidate>
      <section className="life-editor__destination" aria-label="当前发布合集">
        <span>发布到</span>
        <div>
          <strong>{selectedCollection?.name || initial?.chapter?.name || '尚未选择合集'}</strong>
          <small>{selectedCollection?.is_owner ? '我的合集' : '有投稿权限的合集'}</small>
        </div>
        <button type="button" onClick={() => setChangingCollection((value) => !value)}>
          {changingCollection ? '收起' : '重新选择'}
        </button>
      </section>

      {changingCollection && (
        <div className="life-editor__collection-picker">
          <LifeCollectionPicker
            collections={collections}
            onSelect={(collection) => {
              setForm((current) => ({ ...current, chapter_id: collection.id }))
              onCollectionChange(collection)
              setChangingCollection(false)
            }}
          />
        </div>
      )}

      <div className="life-editor__primary">
        <label className="life-editor__title">
          标题 <small>可选，短笔记可以留空</small>
          <input value={form.title} maxLength="100" placeholder="想写标题时再写" aria-invalid={Boolean(fieldErrors.title)} onChange={(event) => update('title', event.target.value)} />
        </label>
        {fieldErrors.title && <p className="form-feedback form-feedback--error">{fieldErrors.title}</p>}

        <section
          className={`life-editor__writing${draggingMedia ? ' is-dragging' : ''}`}
          onDragEnter={allowImageDrop}
          onDragOver={allowImageDrop}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setDraggingMedia(false)
          }}
          onDrop={dropImages}
        >
          <div className="life-editor__writing-heading">
            <label htmlFor="life-post-body">Markdown 正文</label>
            <div className="life-segmented" aria-label="Markdown 编辑模式">
              <button type="button" className={!preview ? 'is-current' : ''} onClick={() => setPreview(false)}>编辑</button>
              <button type="button" className={preview ? 'is-current' : ''} onClick={() => setPreview(true)}>预览</button>
            </div>
          </div>
          {!preview && (
            <div className="markdown-toolbar" role="toolbar" aria-label="Markdown 语法快捷工具">
              <span>插入语法</span>
              <button type="button" title="插入二级标题" onClick={() => insertMarkdown('heading')}>H2 标题</button>
              <button type="button" title="加粗选中文字" onClick={() => insertMarkdown('bold')}><strong>B</strong> 粗体</button>
              <button type="button" title="插入链接" onClick={() => insertMarkdown('link')}>↗ 链接</button>
              <button type="button" title="插入引用" onClick={() => insertMarkdown('quote')}>❯ 引用</button>
              <button type="button" title="插入行内代码或代码块" onClick={() => insertMarkdown('code')}><code>&lt;/&gt;</code> 代码</button>
              <button type="button" title="上传图片并插入正文当前位置" disabled={pending || images.length >= 9} onClick={() => mediaManagerRef.current?.chooseImages('inline')}>▧ 图片</button>
              <button type="button" title="上传 Live Photo 并插入正文当前位置" disabled={pending || images.length >= 9} onClick={() => mediaManagerRef.current?.chooseLivePhoto()}>◉ 实况</button>
            </div>
          )}
          {preview
            ? <MarkdownContent className="markdown-body--preview" media={images} title={form.title || '当前内容'}>{form.body || '*从“编辑”页签开始写作，预览会显示在这里。*'}</MarkdownContent>
            : (
              <>
                <textarea
                  ref={bodyRef}
                  id="life-post-body"
                  rows="18"
                  value={form.body || ''}
                  maxLength="50000"
                  placeholder="写下想留下的内容，支持 Markdown…"
                  onChange={(event) => update('body', event.target.value)}
                  onPaste={pasteImages}
                />
                <small className="life-editor__drop-hint">
                  可将图片拖入或粘贴到正文，上传后会插入当前光标位置。
                </small>
              </>
            )}
        </section>

        <section className="life-editor__cover">
          <div>
            <strong>内容封面 <small>可选</small></strong>
            <small>封面显示在生活列表和详情页顶部，不会自动插入正文。</small>
          </div>
          <div className="life-cover-picker">
            <button
              type="button"
              className={!form.cover_media_id ? 'is-current' : ''}
              onClick={() => update('cover_media_id', null)}
            >
              不设置独立封面
            </button>
            {coverCandidates.map((item, index) => (
              <button
                type="button"
                className={String(form.cover_media_id) === String(item.id) ? 'is-current' : ''}
                key={item.id}
                disabled={Boolean(item.error)}
                aria-label={`将第 ${index + 1} 张图片设为封面`}
                onClick={() => update('cover_media_id', item.id)}
              >
                <AuthenticatedMedia
                  src={item.preview || item.thumbnail_url || item.url}
                  alt=""
                  fit="cover"
                  width={item.width}
                  height={item.height}
                  loading="eager"
                />
                <span>{String(form.cover_media_id) === String(item.id) ? '当前封面' : '设为封面'}</span>
              </button>
            ))}
            <button
              type="button"
              disabled={pending || images.length >= 9}
              onClick={() => mediaManagerRef.current?.chooseImages('cover')}
            >
              ＋ 单独上传封面
            </button>
          </div>
        </section>

        <section className="life-editor__media">
          <div><strong>正文媒体 <small>可选</small></strong><small>上传后会插入 Markdown 光标位置，也可以在这里排序、删除或重试。</small></div>
          <LifeImageManager
            ref={mediaManagerRef}
            value={images}
            onChange={setImages}
            existingIds={[...(initial?.images?.map((image) => image.id) || []), ...protectedMediaIds]}
            disabled={pending}
            coverMediaId={form.cover_media_id}
            onChoose={rememberMediaInsertion}
            onQueued={queueMedia}
            onResolved={resolveMedia}
            onRemoved={removeMedia}
            inlineMediaDetails={inlineMediaDetails}
            onDescriptionChange={changeMediaDescription}
          />
        </section>

        <label className="life-editor__video life-editor__video--secondary">
          外部视频链接 <small>可选</small>
          <input type="url" inputMode="url" maxLength="2048" placeholder="https://www.bilibili.com/video/…" value={form.external_video_url || ''} aria-invalid={Boolean(fieldErrors.external_video_url)} onChange={(event) => update('external_video_url', event.target.value)} />
          <small>支持 Bilibili、YouTube 或其他 HTTP(S) 视频地址；不会在列表中自动播放。</small>
        </label>
        {fieldErrors.external_video_url && <p className="form-feedback form-feedback--error">{fieldErrors.external_video_url}</p>}
      </div>

      <details className="life-editor__more">
        <summary>更多信息 <small>心情、地点、标签、发生时间与可见范围</small></summary>
        <div className="life-editor__more-fields">
          <div className="life-form__pair">
            <label>地点<input value={form.location || ''} maxLength="100" onChange={(event) => update('location', event.target.value)} /></label>
            <label>心情<input value={form.mood || ''} maxLength="30" onChange={(event) => update('mood', event.target.value)} /></label>
          </div>
          <label>拍摄或发生时间<input type="datetime-local" value={localDateTime(form.shot_at)} onChange={(event) => update('shot_at', event.target.value)} /></label>
          <label>可见范围<select value={form.visibility} onChange={(event) => update('visibility', event.target.value)}><option value="public">公开</option><option value="login_only">仅登录用户</option><option value="private">仅自己</option></select></label>
          <div>
            <span className="life-editor__field-label">标签</span>
            <div className="tag-input">
              <input value={tag} maxLength="20" placeholder="输入标签后按回车" onChange={(event) => setTag(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag() } }} />
              <button type="button" onClick={addTag}>添加标签</button>
              {form.tags.map((item) => <button type="button" key={item} onClick={() => setForm((current) => ({ ...current, tags: current.tags.filter((name) => name !== item) }))}>{item} ×</button>)}
            </div>
          </div>
        </div>
      </details>

      {(localError || fieldErrors.content || fieldErrors.media_ids || fieldErrors.chapter_id) && <p className="form-feedback form-feedback--error" role="alert">{localError || fieldErrors.content || fieldErrors.media_ids || fieldErrors.chapter_id}</p>}
      {requestError && !requestError.details?.length && <p className="form-feedback form-feedback--error" role="alert">{requestError.message}</p>}
      <div className="life-form__actions">
        {onSaveDraft && <button type="button" disabled={pending} onClick={saveDraft}>{pending ? '正在保存…' : '保存草稿'}</button>}
        <button className="button button--primary" disabled={pending}>{pending ? '正在保存…' : '发布内容'}</button>
      </div>
    </form>
  )
}
