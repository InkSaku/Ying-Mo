import { useEffect, useRef, useState } from 'react'
import { uploadImage } from '../../api/uploads.js'

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 15 * 1024 * 1024

export default function ImageUploadField({
  purpose = 'content',
  currentImageUrl = null,
  onUploaded,
  onRemove,
  disabled = false,
}) {
  const inputRef = useRef(null)
  const previewUrlRef = useRef(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)

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
      clearPreview()
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
      setError(requestError.message || '删除头像失败，请重试。')
    }
  }

  const imageUrl = previewUrl || currentImageUrl

  return (
    <div className="image-upload-field">
      <div
        className={`image-upload-field__dropzone ${disabled ? 'is-disabled' : ''}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="选择头像图片"
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
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
        {imageUrl ? <img src={imageUrl} alt="头像预览" /> : <span className="image-upload-field__placeholder">选择一张头像图片</span>}
        <span>{uploading ? '正在上传…' : '点击或拖放图片到这里'}</span>
        <small>JPEG、PNG 或 WebP，最大 15 MB</small>
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
          {currentImageUrl ? '更换头像' : '上传头像'}
        </button>
        {(currentImageUrl || previewUrl) && <button type="button" className="button--quiet" onClick={() => void remove()} disabled={disabled || uploading}>{currentImageUrl ? '删除头像' : '清空选择'}</button>}
      </div>
      {error && <p className="form-feedback form-feedback--error" role="alert">{error}</p>}
    </div>
  )
}
