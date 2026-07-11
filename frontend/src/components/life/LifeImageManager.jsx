import { useEffect, useRef, useState } from 'react'
import { deleteUnboundImage, uploadImage } from '../../api/uploads.js'

const valid = new Set(['image/jpeg', 'image/png', 'image/webp'])
export default function LifeImageManager({ value, onChange, existingIds = [] }) {
  const input = useRef(null); const [error, setError] = useState(null); const urls = useRef([])
  useEffect(() => () => urls.current.forEach((url) => URL.revokeObjectURL(url)), [])
  async function add(files) {
    const selected = [...files]; if (value.length + selected.length > 9) return setError('最多上传 9 张图片。')
    for (const file of selected) {
      if (!valid.has(file.type) || file.size > 15 * 1024 * 1024) { setError('仅支持 15 MB 以内的 JPEG、PNG 或 WebP。'); continue }
      const preview = URL.createObjectURL(file); urls.current.push(preview); const temp = { preview, uploading: true, id: `temp-${crypto.randomUUID()}` }; onChange([...value, temp])
      try { const media = await uploadImage(file, 'content'); onChange((current) => current.map((item) => item.id === temp.id ? { ...media, preview } : item)) } catch (requestError) { onChange((current) => current.map((item) => item.id === temp.id ? { ...item, uploading: false, error: requestError.message } : item)) }
    }
  }
  async function remove(item) { onChange(value.filter((entry) => entry.id !== item.id)); if (!existingIds.includes(item.id) && item.public_id) { try { await deleteUnboundImage(item.public_id) } catch { setError('图片已从列表移除，但暂时无法清理上传记录。') } } }
  function move(index, direction) { const next = [...value]; const other = index + direction; if (other < 0 || other >= next.length) return; [next[index], next[other]] = [next[other], next[index]]; onChange(next) }
  return <section className="life-images"><input ref={input} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => void add(event.target.files)} /><button type="button" onClick={() => input.current?.click()} disabled={value.length >= 9}>添加图片</button>{error && <p className="form-feedback form-feedback--error">{error}</p>}<div className="life-images__grid">{value.map((item, index) => <article key={item.id} className="life-images__item"><img src={item.thumbnail_url || item.preview} alt={`第 ${index + 1} 张图片预览`} /><span>{index === 0 ? '封面' : `第 ${index + 1} 张`}</span>{item.uploading && <small>上传中…</small>}{item.error && <small>{item.error}</small>}<div><button type="button" onClick={() => move(index, -1)} disabled={index === 0}>上移</button><button type="button" onClick={() => move(index, 1)} disabled={index === value.length - 1}>下移</button><button type="button" onClick={() => void remove(item)}>删除</button></div></article>)}</div></section>
}
