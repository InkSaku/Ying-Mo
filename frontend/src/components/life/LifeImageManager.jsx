import { useEffect, useRef, useState } from 'react'
import { deleteUnboundImage, uploadImage } from '../../api/uploads.js'

const VALID_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 15 * 1024 * 1024

export default function LifeImageManager({ value, onChange, existingIds = [], disabled = false }) {
  const inputRef = useRef(null)
  const previewsRef = useRef(new Set())
  const valueRef = useRef(value)
  const existingIdsRef = useRef(existingIds)
  const [error, setError] = useState(null)

  useEffect(() => { valueRef.current = value }, [value])
  useEffect(() => { existingIdsRef.current = existingIds }, [existingIds])
  useEffect(() => () => {
    previewsRef.current.forEach((url) => URL.revokeObjectURL(url))
    const unbound = valueRef.current.filter((item) => !existingIdsRef.current.includes(item.id) && item.public_id)
    Promise.allSettled(unbound.map((item) => deleteUnboundImage(item.public_id))).catch(() => {})
  }, [])

  function releasePreview(item) {
    if (item.preview) {
      URL.revokeObjectURL(item.preview)
      previewsRef.current.delete(item.preview)
    }
  }

  async function upload(tempId, file) {
    try {
      const media = await uploadImage(file, 'content')
      onChange((current) => current.map((item) => {
        if (item.id !== tempId) return item
        releasePreview(item)
        return { ...media, uploading: false, error: null, file: null }
      }))
    } catch (requestError) {
      onChange((current) => current.map((item) => item.id === tempId ? { ...item, uploading: false, error: requestError.message || '图片上传失败，请重试。' } : item))
    }
  }

  function add(files) {
    const available = 9 - valueRef.current.length
    const selected = Array.from(files || [])
    if (selected.length > available) setError(`最多只能保留 9 张图片，已选择前 ${Math.max(available, 0)} 张。`)
    const accepted = selected.slice(0, Math.max(available, 0)).flatMap((file) => {
      if (!VALID_TYPES.has(file.type) || file.size > MAX_BYTES) {
        setError('仅支持 15 MB 以内的 JPEG、PNG 或 WebP 图片。')
        return []
      }
      const preview = URL.createObjectURL(file)
      previewsRef.current.add(preview)
      return [{ id: `temp-${crypto.randomUUID()}`, preview, file, uploading: true, error: null }]
    })
    if (!accepted.length) return
    setError(null)
    onChange((current) => [...current, ...accepted])
    accepted.forEach((item) => void upload(item.id, item.file))
  }

  async function remove(item) {
    onChange((current) => current.filter((entry) => entry.id !== item.id))
    releasePreview(item)
    if (!existingIds.includes(item.id) && item.public_id) {
      try {
        await deleteUnboundImage(item.public_id)
      } catch {
        setError('图片已从列表移除，但暂时无法清理上传记录。')
      }
    }
  }

  function retry(item) {
    if (!item.file || item.uploading) return
    onChange((current) => current.map((entry) => entry.id === item.id ? { ...entry, uploading: true, error: null } : entry))
    void upload(item.id, item.file)
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

  return (
    <section className="life-images" aria-label="日常图片">
      <div className="life-images__actions">
        <input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { add(event.target.files); event.target.value = '' }} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled || value.length >= 9}>添加图片</button>
        <small>JPEG、PNG 或 WebP，单张最大 15 MB；最多 9 张。</small>
      </div>
      {error && <p className="form-feedback form-feedback--error" role="alert">{error}</p>}
      <div className="life-images__grid">
        {value.map((item, index) => (
          <article key={item.id} className="life-images__item">
            {item.thumbnail_url || item.preview ? <img src={item.thumbnail_url || item.preview} alt={`第 ${index + 1} 张图片预览`} /> : <div className="image-placeholder">等待上传</div>}
            <span>{index === 0 ? '列表封面' : `第 ${index + 1} 张`}</span>
            {item.uploading && <small>上传中…</small>}
            {item.error && <small className="form-feedback--error">{item.error}</small>}
            <div>
              <button type="button" aria-label={`将第 ${index + 1} 张图片上移`} onClick={() => move(index, -1)} disabled={disabled || index === 0}>上移</button>
              <button type="button" aria-label={`将第 ${index + 1} 张图片下移`} onClick={() => move(index, 1)} disabled={disabled || index === value.length - 1}>下移</button>
              {item.error && item.file && <button type="button" disabled={disabled} onClick={() => retry(item)}>重试</button>}
              <button type="button" disabled={disabled || item.uploading} onClick={() => void remove(item)}>删除</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
