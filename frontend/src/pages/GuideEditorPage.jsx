/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getGameMapHeroes, getGameMaps, getGames } from '../api/games.js'
import { createGuide, getGuide, updateGuide } from '../api/guides.js'
import { createDraft, getDraft, updateDraft } from '../api/drafts.js'
import { deleteUnboundImage, uploadImage } from '../api/uploads.js'
import { useAuth } from '../auth/useAuth.js'

const categories = [['deployment_position', '炮台与部署点位'], ['skill_throw', '技能投掷'], ['timed_throw', '开局定时投掷'], ['hold_position', '架枪与站位'], ['movement_route', '位移与路线'], ['map_interaction', '地图机制与交互'], ['other', '其他点位']]
const blank = { game_id: '', map_id: '', hero_id: '', guide_scope: 'hero_map', content_mode: 'simple', title: '', category: 'deployment_position', instructions: '', map_area: '', side: '', skill: '', aim_reference: '', timing: '', game_version: '', tags: [], notes: '', video_url: '', tested_at: '' }
const errorFields = new Set(['game_id', 'map_id', 'hero_id', 'title', 'category', 'instructions', 'timing', 'visualization', 'video_url', 'steps'])

function mergeOriginal(items, original) {
  if (!original || items.some((item) => item.id === original.id)) return items
  return [original, ...items]
}

function FieldError({ errors, field }) {
  return errors[field] ? <small className="guide-form__error" role="alert">{errors[field]}</small> : null
}

function validExternalUrl(value) {
  if (!value) return true
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

function publishErrors(form, images) {
  const errors = {}
  if (!form.game_id) errors.game_id = '请选择游戏。'
  if (!form.map_id) errors.map_id = '请选择地图。'
  if (!form.hero_id) errors.hero_id = '请选择英雄。'
  if (!form.title.trim()) errors.title = '请填写点位标题。'
  if (!form.category) errors.category = '请选择点位分类。'
  if (!form.instructions.trim()) errors.instructions = '请填写详细说明。'
  if (form.category === 'timed_throw' && !form.timing.trim()) errors.timing = '开局定时投掷必须填写投掷时间或时机。'
  if (!images.length && !form.video_url.trim()) errors.visualization = '请至少上传一张图片或填写合法外部视频链接。'
  if (!validExternalUrl(form.video_url.trim())) errors.video_url = '请输入合法的 http 或 https 外部视频链接。'
  if (form.content_mode === 'steps' && images.some((item) => !item.title.trim() || !item.description.trim())) errors.steps = '分步模式下，每张图片都需要标题和说明。'
  return errors
}

export default function GuideEditorPage({ edit = false }) {
  const { id } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const [search] = useSearchParams()
  const initialDraftId = search.get('draft') || ''
  const [form, setForm] = useState({ ...blank })
  const [games, setGames] = useState([])
  const [maps, setMaps] = useState([])
  const [heroes, setHeroes] = useState([])
  const [images, setImages] = useState([])
  const [historical, setHistorical] = useState({ game: null, map: null, hero: null })
  const [draftId, setDraftId] = useState(initialDraftId)
  const [sourceReady, setSourceReady] = useState(!edit && !initialDraftId)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [mapsLoading, setMapsLoading] = useState(false)
  const [heroesLoading, setHeroesLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const mapRequest = useRef(0)
  const heroRequest = useRef(0)
  const unboundUploads = useRef(new Set())

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const gameOptions = useMemo(() => mergeOriginal(games, historical.game), [games, historical.game])
  const mapOptions = useMemo(() => mergeOriginal(maps, historical.map?.game?.id === Number(form.game_id) || historical.game?.id === Number(form.game_id) ? historical.map : null), [maps, historical, form.game_id])
  const heroOptions = useMemo(() => mergeOriginal(heroes, historical.hero?.game?.id === Number(form.game_id) || historical.game?.id === Number(form.game_id) ? historical.hero : null), [heroes, historical, form.game_id])
  const selectedGame = gameOptions.find((item) => item.id === Number(form.game_id))
  const selectedMap = mapOptions.find((item) => item.id === Number(form.map_id))
  const selectedHero = heroOptions.find((item) => item.id === Number(form.hero_id))

  useEffect(() => {
    let cancelled = false
    getGames({ page_size: 100 })
      .then((result) => {
        if (!cancelled) setGames(result.data)
      })
      .catch((reason) => {
        if (!cancelled) setError(reason.message)
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!edit && !initialDraftId) return
    let cancelled = false
    const load = edit ? getGuide(id) : getDraft(initialDraftId)
    load.then((data) => {
      if (cancelled) return
      const source = edit ? data : data.payload
      setForm((current) => {
        const next = { ...current }
        for (const key of Object.keys(blank)) {
          if (Object.hasOwn(source, key)) next[key] = source[key] ?? blank[key]
        }
        return {
          ...next,
          game_id: String(source.game_id || source.game?.id || ''),
          map_id: String(source.map_id || source.map?.id || ''),
          hero_id: String(source.hero_id || source.hero?.id || ''),
          guide_scope: 'hero_map',
          content_mode: source.content_mode || 'simple',
        }
      })
      if (edit) setHistorical({ game: data.game, map: data.map, hero: data.hero })
      const media = new Map((data.media || []).map((item) => [item.id, item]))
      const steps = edit ? data.steps : (source.steps || [])
      setImages(steps.map((step) => {
        const savedMedia = media.get(step.media_id)
        return {
          media_id: step.media_id,
          title: step.title || '',
          description: step.description || '',
          thumbnail_url: step.thumbnail_url || savedMedia?.thumbnail_url,
          public_id: step.public_id || savedMedia?.public_id,
          existing: true,
        }
      }))
    }).catch((reason) => setError(reason.message)).finally(() => {
      if (!cancelled) setSourceReady(true)
    })
    return () => { cancelled = true }
  }, [edit, id])

  useEffect(() => {
    if (!sourceReady || edit || initialDraftId || !games.length) return
    const requested = games.find((item) => item.slug === search.get('game'))
    if (requested) update('game_id', String(requested.id))
    else if (games.length === 1) update('game_id', String(games[0].id))
  }, [games, sourceReady])

  useEffect(() => {
    if (!sourceReady || !form.game_id) {
      setMaps([])
      setMapsLoading(false)
      return
    }
    const game = gameOptions.find((item) => item.id === Number(form.game_id))
    if (!game || game.is_available === false || game.status === 'inactive') {
      setMaps([])
      setMapsLoading(false)
      return
    }
    const controller = new AbortController()
    const requestId = ++mapRequest.current
    setMapsLoading(true)
    getGameMaps(game.slug, { page_size: 100 }, controller.signal)
      .then((result) => {
        if (requestId !== mapRequest.current) return
        setMaps(result.data)
        if (!edit && !initialDraftId) {
          const requested = result.data.find((item) => item.slug === search.get('map'))
          if (requested) setForm((current) => current.game_id === String(game.id) ? { ...current, map_id: String(requested.id) } : current)
        }
      })
      .catch((reason) => {
        if (reason.code !== 'REQUEST_CANCELLED' && requestId === mapRequest.current) setError(reason.message)
      })
      .finally(() => {
        if (requestId === mapRequest.current) setMapsLoading(false)
      })
    return () => {
      controller.abort()
      mapRequest.current += 1
    }
  }, [form.game_id, sourceReady, games, historical.game])

  useEffect(() => {
    if (!sourceReady || !form.game_id || !form.map_id) {
      setHeroes([])
      setHeroesLoading(false)
      return
    }
    const game = gameOptions.find((item) => item.id === Number(form.game_id))
    const gameMap = mapOptions.find((item) => item.id === Number(form.map_id))
    if (!game || !gameMap || game.is_available === false || game.status === 'inactive' || gameMap.is_available === false || gameMap.current_status === 'retired') {
      setHeroes([])
      setHeroesLoading(false)
      return
    }
    const controller = new AbortController()
    const requestId = ++heroRequest.current
    setHeroesLoading(true)
    getGameMapHeroes(game.slug, gameMap.slug, { page_size: 100 }, controller.signal)
      .then((result) => {
        if (requestId !== heroRequest.current) return
        setHeroes(result.data)
        if (!edit && !initialDraftId) {
          const requested = result.data.find((item) => item.slug === search.get('hero'))
          if (requested) setForm((current) => current.map_id === String(gameMap.id) ? { ...current, hero_id: String(requested.id) } : current)
        }
      })
      .catch((reason) => {
        if (reason.code !== 'REQUEST_CANCELLED' && requestId === heroRequest.current) setError(reason.message)
      })
      .finally(() => {
        if (requestId === heroRequest.current) setHeroesLoading(false)
      })
    return () => {
      controller.abort()
      heroRequest.current += 1
    }
  }, [form.game_id, form.map_id, sourceReady, maps, historical])

  useEffect(() => () => {
    for (const publicId of unboundUploads.current) void deleteUnboundImage(publicId).catch(() => {})
  }, [])

  async function addImages(files) {
    for (const file of Array.from(files || []).slice(0, Math.max(0, 20 - images.length))) {
      try {
        const media = await uploadImage(file)
        unboundUploads.current.add(media.public_id)
        setImages((items) => [...items, { media_id: media.id, title: '', description: '', thumbnail_url: media.thumbnail_url, public_id: media.public_id, existing: false }])
        setFieldErrors((current) => {
          const next = { ...current }
          delete next.visualization
          delete next.steps
          return next
        })
      } catch (reason) {
        setError(reason.message)
        break
      }
    }
  }

  async function removeImage(index) {
    const item = images[index]
    setImages((items) => items.filter((_, itemIndex) => itemIndex !== index))
    if (item.public_id && !item.existing) {
      unboundUploads.current.delete(item.public_id)
      await deleteUnboundImage(item.public_id).catch(() => {})
    }
  }

  function moveImage(index, offset) {
    setImages((items) => {
      const destination = index + offset
      if (destination < 0 || destination >= items.length) return items
      const next = [...items]
      const [item] = next.splice(index, 1)
      next.splice(destination, 0, item)
      return next
    })
  }

  function payload() {
    const id = (value) => value ? Number(value) : null
    return {
      ...form,
      game_id: id(form.game_id),
      map_id: id(form.map_id),
      hero_id: id(form.hero_id),
      side: form.side || null,
      tags: typeof form.tags === 'string' ? form.tags.split(',').map((item) => item.trim()).filter(Boolean) : form.tags,
      steps: images.map((item) => ({ media_id: item.media_id, title: item.title || null, description: item.description || null })),
    }
  }

  function applyApiError(reason) {
    const next = {}
    for (const detail of reason.details || []) {
      if (errorFields.has(detail.field) && !next[detail.field]) next[detail.field] = detail.message
    }
    setFieldErrors(next)
    setError(reason.message)
  }

  async function saveDraft() {
    setPending(true)
    setError('')
    setNotice('')
    try {
      const value = payload()
      const media_ids = images.map((item) => item.media_id)
      const draft = draftId
        ? await updateDraft(draftId, { payload: value, media_ids })
        : await createDraft({ draft_type: 'game_guide', payload: value, media_ids })
      setDraftId(String(draft.id))
      setImages((items) => items.map((item) => ({ ...item, existing: true })))
      unboundUploads.current.clear()
      setNotice('草稿已保存，可以稍后继续编辑。')
    } catch (reason) {
      applyApiError(reason)
    } finally {
      setPending(false)
    }
  }

  async function submit(event) {
    event.preventDefault()
    const localErrors = publishErrors(form, images)
    setFieldErrors(localErrors)
    setNotice('')
    if (Object.keys(localErrors).length) {
      setError('请检查标出的必填项。')
      return
    }
    setPending(true)
    setError('')
    try {
      const value = payload()
      if (draftId) value.draft_id = Number(draftId)
      const guide = edit ? await updateGuide(id, value) : await createGuide(value)
      unboundUploads.current.clear()
      nav(`/guide/${guide.id}`)
    } catch (reason) {
      applyApiError(reason)
    } finally {
      setPending(false)
    }
  }

  function changeGame(value) {
    mapRequest.current += 1
    heroRequest.current += 1
    setMaps([])
    setHeroes([])
    setForm((current) => ({ ...current, game_id: value, map_id: '', hero_id: '' }))
    setFieldErrors((current) => ({ ...current, game_id: undefined, map_id: undefined, hero_id: undefined }))
  }

  function changeMap(value) {
    heroRequest.current += 1
    setHeroes([])
    setForm((current) => ({ ...current, map_id: value, hero_id: '' }))
    setFieldErrors((current) => ({ ...current, map_id: undefined, hero_id: undefined }))
  }

  const isAdmin = ['content_admin', 'system_admin'].includes(user?.role)
  const contextLabel = [selectedGame?.name_zh, selectedMap?.name_zh, selectedHero?.name_zh].filter(Boolean).join(' / ')

  if (catalogLoading || !sourceReady) return <section className="guides-page page-container"><p className="state-message">正在准备点位编辑器…</p></section>
  if (!gameOptions.length && error) {
    return <section className="guides-page page-container"><div className="state-message state-message--error" role="alert"><h1>游戏目录加载失败</h1><p>{error}</p></div></section>
  }
  if (!gameOptions.length && !edit && !initialDraftId) {
    return <section className="guides-page page-container">
      <Link className="text-link" to="/games">返回游戏区</Link>
      <div className="guide-editor-empty">
        <h1>当前没有可用于发布点位的游戏</h1>
        <p>游戏、地图和英雄由管理员统一维护。普通用户不能创建正式目录。</p>
        {isAdmin && <Link className="button button--primary" to="/admin/catalog">前往游戏目录管理</Link>}
      </div>
    </section>
  }

  return <section className="guides-page page-container">
    <Link className="text-link" to="/games">返回游戏区</Link>
    <h1>{edit ? '编辑点位' : '发布点位'}</h1>
    <p>按照游戏、地图、英雄的顺序确定上下文，再记录可快速复现的点位。</p>
    {contextLabel && <p className="guide-context" aria-label="当前点位上下文">{contextLabel}</p>}
    {historical.game?.is_available === false || historical.map?.is_available === false || historical.hero?.is_available === false
      ? <p className="catalog-warning">原目录当前不可用于新发布，但历史点位可以保留原关联并继续编辑内容。</p>
      : null}
    {error && <p className="state-message state-message--error" role="alert">{error}</p>}
    {notice && <p className="state-message state-message--success" role="status">{notice}</p>}
    <form className="guide-form" onSubmit={submit} noValidate>
      <fieldset className="guide-form__catalog">
        <legend>点位目录</legend>
        <label>游戏
          <select aria-label="游戏" value={form.game_id} onChange={(event) => changeGame(event.target.value)}>
            <option value="">选择游戏</option>
            {gameOptions.map((item) => <option key={item.id} value={item.id}>{item.name_zh}{item.is_available === false || item.status === 'inactive' ? '（历史关联，当前不可用）' : ''}</option>)}
          </select>
          <FieldError errors={fieldErrors} field="game_id" />
        </label>
        <label>地图
          <select aria-label="地图" value={form.map_id} disabled={!form.game_id || mapsLoading} onChange={(event) => changeMap(event.target.value)}>
            <option value="">{mapsLoading ? '正在加载地图…' : '选择地图'}</option>
            {mapOptions.map((item) => <option key={item.id} value={item.id}>{item.name_zh}{item.is_available === false || item.current_status === 'retired' ? '（历史关联，当前不可用）' : ''}</option>)}
          </select>
          <FieldError errors={fieldErrors} field="map_id" />
          {form.game_id && !mapsLoading && !mapOptions.length && <small>这款游戏还没有可用于发布点位的地图。</small>}
        </label>
        <label>英雄
          <select aria-label="英雄" value={form.hero_id} disabled={!form.map_id || heroesLoading} onChange={(event) => update('hero_id', event.target.value)}>
            <option value="">{heroesLoading ? '正在加载英雄…' : '选择英雄'}</option>
            {heroOptions.map((item) => <option key={item.id} value={item.id}>{item.name_zh}{item.guide_count != null ? `（当前地图 ${item.guide_count} 个点位）` : ''}{item.is_available === false || item.status === 'inactive' ? '（历史关联，当前不可用）' : ''}</option>)}
          </select>
          <FieldError errors={fieldErrors} field="hero_id" />
          {form.map_id && !heroesLoading && !heroOptions.length && <small>这张地图还没有可用于发布点位的英雄。</small>}
        </label>
      </fieldset>

      <label>点位标题<input aria-label="点位标题" value={form.title} onChange={(event) => update('title', event.target.value)} /><FieldError errors={fieldErrors} field="title" /></label>
      <label>点位分类<select aria-label="点位分类" value={form.category} onChange={(event) => update('category', event.target.value)}>{categories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><FieldError errors={fieldErrors} field="category" /></label>
      <label>投掷时间或时机{form.category === 'timed_throw' ? '（必填）' : '（选填）'}<input aria-label="投掷时间或时机" value={form.timing} onChange={(event) => update('timing', event.target.value)} placeholder="例如：开门后约 2.5 秒" /><FieldError errors={fieldErrors} field="timing" /></label>
      <label>详细说明<textarea aria-label="详细说明" value={form.instructions} onChange={(event) => update('instructions', event.target.value)} placeholder="说明站位、朝向、操作、时机和效果。" /><FieldError errors={fieldErrors} field="instructions" /></label>
      <label>外部视频链接（可选）<input aria-label="外部视频链接" type="url" value={form.video_url || ''} onChange={(event) => update('video_url', event.target.value)} placeholder="https://…" /><FieldError errors={fieldErrors} field="video_url" /></label>
      <fieldset className="guide-form__mode">
        <legend>图片说明模式</legend>
        <label><input type="radio" name="content-mode" checked={form.content_mode === 'simple'} onChange={() => update('content_mode', 'simple')} />简单模式</label>
        <label><input type="radio" name="content-mode" checked={form.content_mode === 'steps'} onChange={() => update('content_mode', 'steps')} />分步模式</label>
      </fieldset>
      <section className="guide-form__images">
        <h2>图片</h2>
        <p>{form.content_mode === 'steps' ? '分步模式下，每张图片都需要标题和说明。' : '简单模式下，图片标题和说明均为选填。'} 最多 20 张。</p>
        <input aria-label="上传点位图片" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { void addImages(event.target.files); event.target.value = '' }} />
        <FieldError errors={fieldErrors} field="visualization" />
        <FieldError errors={fieldErrors} field="steps" />
        {images.map((item, index) => <article className="guide-step-editor" key={item.media_id}>
          {item.thumbnail_url && <img src={item.thumbnail_url} alt={`点位图片 ${index + 1}`} />}
          <input aria-label={`图片 ${index + 1} 标题`} placeholder={`图片标题${form.content_mode === 'steps' ? '（必填）' : '（可选）'}`} value={item.title} onChange={(event) => setImages((items) => items.map((value, itemIndex) => itemIndex === index ? { ...value, title: event.target.value } : value))} />
          <textarea aria-label={`图片 ${index + 1} 说明`} placeholder={`图片说明${form.content_mode === 'steps' ? '（必填）' : '（可选）'}`} value={item.description} onChange={(event) => setImages((items) => items.map((value, itemIndex) => itemIndex === index ? { ...value, description: event.target.value } : value))} />
          <div className="guide-step-editor__actions">
            <button type="button" disabled={index === 0} onClick={() => moveImage(index, -1)}>上移</button>
            <button type="button" disabled={index === images.length - 1} onClick={() => moveImage(index, 1)}>下移</button>
            <button type="button" onClick={() => void removeImage(index)}>移除图片</button>
          </div>
        </article>)}
      </section>
      <details>
        <summary>更多点位信息</summary>
        <div className="guide-form__optional">
          <label>地图区域<input aria-label="地图区域" value={form.map_area || ''} onChange={(event) => update('map_area', event.target.value)} /></label>
          <label>攻防方<select aria-label="攻防方" value={form.side || ''} onChange={(event) => update('side', event.target.value)}><option value="">未指定</option><option value="attack">进攻方</option><option value="defense">防守方</option><option value="both">攻防皆可</option></select></label>
          <label>技能<input aria-label="技能" value={form.skill || ''} onChange={(event) => update('skill', event.target.value)} /></label>
          <label>瞄准参照物<input aria-label="瞄准参照物" value={form.aim_reference || ''} onChange={(event) => update('aim_reference', event.target.value)} /></label>
          <label>游戏版本<input aria-label="游戏版本" value={form.game_version || ''} onChange={(event) => update('game_version', event.target.value)} /></label>
          <label>测试日期<input aria-label="测试日期" type="date" value={form.tested_at || ''} onChange={(event) => update('tested_at', event.target.value)} /></label>
          <label>标签（逗号分隔）<input aria-label="标签" value={Array.isArray(form.tags) ? form.tags.join(',') : form.tags || ''} onChange={(event) => update('tags', event.target.value)} /></label>
          <label>注意事项<textarea aria-label="注意事项" value={form.notes || ''} onChange={(event) => update('notes', event.target.value)} /></label>
        </div>
      </details>
      <div className="guide-form__actions">
        {!edit && <button type="button" disabled={pending} onClick={() => void saveDraft()}>保存草稿</button>}
        <button className="button button--primary" disabled={pending}>{pending ? '正在保存…' : edit ? '保存修改' : '发布点位'}</button>
      </div>
    </form>
  </section>
}
