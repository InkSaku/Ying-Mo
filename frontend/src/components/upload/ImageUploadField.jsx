import { useEffect, useRef, useState } from 'react'
import { uploadImage } from '../../api/uploads.js'
import useAuthenticatedImageUrl from '../../hooks/useAuthenticatedImageUrl.js'
import AdaptiveMedia from '../common/AdaptiveMedia.jsx'

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 15 * 1024 * 1024

export default function ImageUploadField({
  purpose = 'content',
  currentImageUrl = null,
  onUploaded,
  onRemove,
  disabled = false,
  label = '头像',
  variant = null,
}) {
  const displayVariant = variant || (label.includes('封面') ? 'cover' : 'avatar')
  const inputRef = useRef(null)
  const previewUrlRef = useRef(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const { url: authenticatedImageUrl, loading: imageLoading, error: imageError } = useAuthenticatedImageUrl(previewUrl ? null : currentImageUrl)

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  function clearPreview() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
    setPreviewUrl(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function selectFile(file) {
    if (!file || uploading || disabled) return
    setError(null)
    if (!ACCEPTED_TYPES.has(file.type)) {
      setError('请选择 JPEG、PNG 或 WebP 格式的图片。')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('图片不能超过 15 MB。')
      return
    }
    clearPreview()
    const nextPreview = URL.createObjectURL(file)
    previewUrlRef.current = nextPreview
    setPreviewUrl(nextPreview)
    setUploading(true)
    try {
      const media = await uploadImage(file, purpose)
      await onUploaded(media)
    } catch (requestError) {
      setError(requestError.message || '图片上传失败，请重试。')
    } finally {
      setUploading(false)
    }
  }

  async function remove() {
    if (disabled || uploading) return
    setError(null)
    if (!currentImageUrl && previewUrl) {
      clearPreview()
      return
    }
    if (!onRemove) return
    try {
      await onRemove()
      clearPreview()
    } catch (requestError) {
      setError(requestError.message || `删除${label}失败，请重试。`)
    }
  }

  const imageUrl = previewUrl || authenticatedImageUrl
  const previewUnavailable = !imageUrl && Boolean(currentImageUrl) && !imageLoading

  return (
    <div className={`image-upload-field image-upload-field--${displayVariant}`}>
      <div
        className={`image-upload-field__dropzone ${disabled ? 'is-disabled' : ''}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={`选择${label}图片`}
        aria-busy={uploading || imageLoading}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (!disabled && !uploading && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          void selectFile(event.dataTransfer.files?.[0])
        }}
      >
        <span className="image-upload-field__preview-frame">
          {imageUrl && <AdaptiveMedia src={imageUrl} alt={`${label}预览`} fit={displayVariant === 'avatar' ? 'cover' : 'contain'} loading="eager" />}
          {!imageUrl && !previewUnavailable && <span className="image-upload-field__placeholder">{imageLoading ? '正在准备预览…' : `选择一张${label}图片`}</span>}
          {previewUnavailable && <span className="image-upload-field__preview-error">{imageError ? '预览加载失败，可重新选择图片。' : '预览暂时不可用。'}</span>}
          {uploading && <span className="image-upload-field__preview-status">正在上传…</span>}
        </span>
        <span>{uploading ? '图片上传中，请稍候' : '点击或拖放图片到这里'}</span>
        <small>{displayVariant === 'cover' ? '各种比例都会完整预览；JPEG、PNG 或 WebP，最大 15 MB' : 'JPEG、PNG 或 WebP，最大 15 MB'}</small>
      </div>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || uploading}
        onChange={(event) => void selectFile(event.target.files?.[0])}
      />
      <div className="image-upload-field__actions">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled || uploading}>
          {currentImageUrl ? `更换${label}` : `上传${label}`}
        </button>
        {(currentImageUrl || previewUrl) && <button type="button" className="button--quiet" onClick={() => void remove()} disabled={disabled || uploading}>{currentImageUrl ? `删除${label}` : '清空选择'}</button>}
      </div>
      {error && <p className="form-feedback form-feedback--error" role="alert">{error}</p>}
    </div>
  )
}
