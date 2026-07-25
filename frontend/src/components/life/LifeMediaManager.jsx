import { useEffect, useRef, useState } from 'react'
import {
  deleteUnboundMedia,
  uploadImage,
  uploadLiveVideo,
} from '../../api/uploads.js'
import useAuthenticatedImageUrl from '../../hooks/useAuthenticatedImageUrl.js'
import AdaptiveMedia from '../common/AdaptiveMedia.jsx'

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', ''])
const IMAGE_MAX_BYTES = 15 * 1024 * 1024
const VIDEO_MAX_BYTES = 50 * 1024 * 1024

function isLive(item) {
  return item.media_type === 'live_video'
}

function validVideoFile(file) {
  return VIDEO_TYPES.has(file.type)
    || /\.(?:mov|mp4)$/i.test(file.name || '')
}

function MediaPreview({ item, index }) {
  const remoteSource = item.thumbnail_url || (!isLive(item) ? item.url : null)
  const { url, loading, error } = useAuthenticatedImageUrl(remoteSource)
  if (item.preview && isLive(item)) {
    return (
      <div className="life-images__preview life-images__preview--live">
        <video src={item.preview} muted playsInline preload="metadata" aria-label={`第 ${index + 1} 个实况本地预览`} />
        <span className="live-photo-badge">实况</span>
      </div>
    )
  }
  const source = item.preview || url
  return (
    <div className={`life-images__preview${isLive(item) ? ' life-images__preview--live' : ''}`} aria-busy={loading || item.uploading}>
      {source && <AdaptiveMedia src={source} alt={`第 ${index + 1} 个媒体预览`} fit="natural" width={item.width} height={item.height} loading="eager" />}
      {!source && <div className="image-placeholder">{error ? '预览暂时不可用' : loading ? '正在准备预览…' : '等待上传'}</div>}
      {isLive(item) && <span className="live-photo-badge">实况</span>}
    </div>
  )
}

function UploadGuide({ onClose, onContinue }) {
  return (
    <div className="life-media-guide" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="live-upload-title">
        <h2 id="live-upload-title">上传 iPhone 实况照片</h2>
        <ol>
          <li>在 iPhone“照片”中打开需要分享的实况照片</li>
          <li>点击右上角“...”</li>
          <li>选择“存储为视频”</li>
          <li>回到映墨，选择刚刚生成的视频</li>
        </ol>
        <p>原来的实况照片不会被删除。</p>
        <div className="life-form__actions">
          <button type="button" onClick={onClose}>取消</button>
          <button type="button" className="button button--primary" onClick={onContinue} autoFocus>我已存储为视频，开始选择</button>
        </div>
      </section>
    </div>
  )
}

export default function LifeMediaManager({ value, onChange, existingIds = [], disabled = false }) {
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const previewsRef = useRef(new Set())
  const valueRef = useRef(value)
  const existingIdsRef = useRef(existingIds)
  const mountedRef = useRef(true)
  const removedUploadsRef = useRef(new Set())
  const [error, setError] = useState(null)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => { valueRef.current = value }, [value])
  useEffect(() => { existingIdsRef.current = existingIds }, [existingIds])
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      previewsRef.current.forEach((url) => {
        URL.revokeObjectURL(url)
      })
      const unbound = valueRef.current.filter(
        (item) =>
          !existingIdsRef.current.includes(item.id)
          && item.public_id,
      )
      void Promise.allSettled(
        unbound.map((item) => deleteUnboundMedia(item.public_id)),
      )
    }
  }, [])

  function releasePreview(item) {
    if (!item.preview) return
    URL.revokeObjectURL(item.preview)
    previewsRef.current.delete(item.preview)
  }

  async function upload(tempId, file, mediaType) {
    try {
      const updateProgress = mediaType === 'live_video'
        ? (event) => {
            if (!mountedRef.current || removedUploadsRef.current.has(tempId)) return
            const total = event.total || 0
            const progress = total ? Math.min(99, Math.round((event.loaded / total) * 100)) : null
            const processing = Boolean(total && event.loaded >= total)
            onChange((current) => current.map((item) => item.id === tempId
              ? { ...item, upload_progress: progress, processing }
              : item))
          }
        : undefined
      const media = mediaType === 'live_video'
        ? await uploadLiveVideo(file, { onUploadProgress: updateProgress })
        : await uploadImage(file, 'content')
      if (!mountedRef.current || removedUploadsRef.current.has(tempId)) {
        await deleteUnboundMedia(media.public_id).catch(() => {})
        return
      }
      onChange((current) => current.map((item) => {
        if (item.id !== tempId) return item
        releasePreview(item)
        return {
          ...media,
          uploading: false,
          upload_progress: 100,
          processing: false,
          error: null,
          file: null,
        }
      }))
    } catch (requestError) {
      if (!mountedRef.current || removedUploadsRef.current.has(tempId)) return
      onChange((current) => current.map((item) => item.id === tempId
        ? {
            ...item,
            uploading: false,
            processing: false,
            error: requestError.message || (mediaType === 'live_video' ? '实况上传失败，请重试。' : '照片上传失败，请重试。'),
          }
        : item))
    }
  }

  function addImages(files) {
    const available = 9 - valueRef.current.length
    const selected = Array.from(files || [])
    if (selected.length > available) setError(`每篇日常最多保留 9 个媒体，已选择前 ${Math.max(available, 0)} 个。`)
    const accepted = selected.slice(0, Math.max(available, 0)).flatMap((file) => {
      if (!IMAGE_TYPES.has(file.type) || file.size > IMAGE_MAX_BYTES) {
        setError('照片仅支持 15 MB 以内的 JPEG、PNG 或 WebP。')
        return []
      }
      const preview = URL.createObjectURL(file)
      previewsRef.current.add(preview)
      return [{
        id: `temp-${crypto.randomUUID()}`,
        media_type: 'image',
        preview,
        file,
        uploading: true,
        error: null,
      }]
    })
    if (!accepted.length) return
    setError(null)
    onChange((current) => [...current, ...accepted])
    accepted.forEach((item) => void upload(item.id, item.file, 'image'))
  }

  function addLiveVideos(files) {
    const selected = Array.from(files || [])
    const totalAvailable = 9 - valueRef.current.length
    const liveAvailable = 3 - valueRef.current.filter(isLive).length
    const available = Math.max(0, Math.min(totalAvailable, liveAvailable))
    if (selected.length > available) {
      setError(liveAvailable <= totalAvailable ? '每篇日常最多添加 3 个实况。' : '每篇日常最多添加 9 个媒体。')
    }
    const accepted = selected.slice(0, available).flatMap((file) => {
      if (!validVideoFile(file)) {
        setError('请选择从 iPhone 实况照片“存储为视频”后得到的文件。')
        return []
      }
      if (file.size > VIDEO_MAX_BYTES) {
        setError('动态照片不能超过 50 MB。')
        return []
      }
      const preview = URL.createObjectURL(file)
      previewsRef.current.add(preview)
      return [{
        id: `temp-${crypto.randomUUID()}`,
        media_type: 'live_video',
        preview,
        file,
        uploading: true,
        upload_progress: 0,
        processing: false,
        error: null,
      }]
    })
    if (!accepted.length) return
    setError(null)
    onChange((current) => [...current, ...accepted])
    accepted.forEach((item) => void upload(item.id, item.file, 'live_video'))
  }

  async function remove(item) {
    if (!Number.isInteger(item.id)) removedUploadsRef.current.add(item.id)
    onChange((current) => current.filter((entry) => entry.id !== item.id))
    releasePreview(item)
    if (!existingIds.includes(item.id) && item.public_id) {
      try {
        await deleteUnboundMedia(item.public_id)
      } catch {
        setError('媒体已从列表移除，但暂时无法清理上传记录。')
      }
    }
  }

  function retry(item) {
    if (!item.file || item.uploading) return
    onChange((current) => current.map((entry) => entry.id === item.id
      ? { ...entry, uploading: true, upload_progress: 0, processing: false, error: null }
      : entry))
    void upload(item.id, item.file, item.media_type || 'image')
  }

  function move(index, direction) {
    onChange((current) => {
      const next = [...current]
      const other = index + direction
      if (other < 0 || other >= next.length) return current
      ;[next[index], next[other]] = [next[other], next[index]]
      return next
    })
  }

  const liveCount = value.filter(isLive).length
  return (
    <section className="life-images" aria-label="日常照片和实况">
      <div className="life-images__actions">
        <input ref={imageInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { addImages(event.target.files); event.target.value = '' }} />
        <input ref={videoInputRef} className="sr-only" type="file" accept="video/mp4,video/quicktime,.mp4,.mov" multiple onChange={(event) => { addLiveVideos(event.target.files); event.target.value = '' }} />
        <div className="life-media-actions">
          <button type="button" onClick={() => imageInputRef.current?.click()} disabled={disabled || value.length >= 9}>添加照片</button>
          <button type="button" onClick={() => setShowGuide(true)} disabled={disabled || value.length >= 9 || liveCount >= 3}>添加实况</button>
        </div>
        <small>照片与实况合计最多 9 个，其中实况最多 3 个。首项会作为列表封面，列表不会自动播放。</small>
      </div>
      {error && <p className="form-feedback form-feedback--error" role="alert">{error}</p>}
      <div className="life-images__grid">
        {value.map((item, index) => (
          <article key={item.id} className="life-images__item">
            <MediaPreview item={{ media_type: item.media_type || 'image', ...item }} index={index} />
            <div className="life-images__caption">
              <span>{index === 0 ? '列表封面' : `第 ${index + 1} 个`} · {isLive(item) ? '实况' : '照片'}</span>
              {item.width && item.height ? <small>{item.width} × {item.height}</small> : null}
            </div>
            {item.uploading && (
              <small>
                {item.processing
                  ? '正在处理动态照片…'
                  : Number.isInteger(item.upload_progress)
                    ? `正在上传 ${item.upload_progress}%`
                    : '正在上传并处理…'}
              </small>
            )}
            {item.error && <small className="form-feedback--error">{item.error}</small>}
            <div className="life-images__item-actions">
              <button type="button" aria-label={`将第 ${index + 1} 个媒体上移`} onClick={() => move(index, -1)} disabled={disabled || index === 0}>上移</button>
              <button type="button" aria-label={`将第 ${index + 1} 个媒体下移`} onClick={() => move(index, 1)} disabled={disabled || index === value.length - 1}>下移</button>
              {item.error && item.file && <button type="button" disabled={disabled} onClick={() => retry(item)}>重试</button>}
              <button type="button" disabled={disabled} onClick={() => void remove(item)}>删除</button>
            </div>
          </article>
        ))}
      </div>
      {showGuide && <UploadGuide onClose={() => setShowGuide(false)} onContinue={() => { setShowGuide(false); videoInputRef.current?.click() }} />}
    </section>
  )
}
