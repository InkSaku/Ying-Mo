import ImageUploadField from '../upload/ImageUploadField.jsx'

export default function ChapterCoverField({ imageUrl, onUploaded, onRemove, disabled, error }) {
  return (
    <section className="chapter-cover" aria-labelledby="chapter-cover-title">
      <h2 id="chapter-cover-title">章节封面（可选）</h2>
      <p>可以保留当前封面、上传新封面替换，或移除封面。</p>
      <ImageUploadField label="章节封面" variant="cover" purpose="content" currentImageUrl={imageUrl} onUploaded={onUploaded} onRemove={onRemove} disabled={disabled} />
      {error && <p className="form-feedback form-feedback--error">{error}</p>}
    </section>
  )
}
