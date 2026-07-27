import { useEffect, useRef, useState } from 'react'
import { getMediaPlaybackUrl } from '../../api/uploads.js'
import useAuthenticatedImageUrl from '../../hooks/useAuthenticatedImageUrl.js'

const ACTIVE_EVENT = 'yingmo:live-photo-play'

function durationText(durationMs) {
  if (!durationMs) return null
  const seconds = Math.max(1, Math.round(durationMs / 1000))
  return `0:${String(seconds).padStart(2, '0')}`
}

export default function LivePhotoPlayer({ media, title, eager = false }) {
  const videoRef = useRef(null)
  const retryRef = useRef(0)
  const [playbackUrl, setPlaybackUrl] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState(null)
  const { url: posterUrl } = useAuthenticatedImageUrl(media.thumbnail_url)
  const playerId = media.public_id || String(media.id)

  useEffect(() => {
    const pauseOther = (event) => {
      if (event.detail === playerId) return
      const video = videoRef.current
      if (video) {
        video.pause()
        video.removeAttribute('src')
        video.load()
      }
      setPlaying(false)
      setPlaybackUrl(null)
      retryRef.current = 0
    }
    window.addEventListener(ACTIVE_EVENT, pauseOther)
    return () => {
      window.removeEventListener(ACTIVE_EVENT, pauseOther)
    }
  }, [playerId])

  useEffect(() => {
    if (!playbackUrl) return undefined
    const video = videoRef.current
    return () => {
      if (!video) return
      video.pause()
      video.removeAttribute('src')
    }
  }, [playbackUrl])

  useEffect(() => {
    if (!playbackUrl || !playing || !videoRef.current) return
    videoRef.current.play().catch(() => {
      setPlaying(false)
      setError('浏览器暂时无法开始播放，请再点一次。')
    })
  }, [playbackUrl, playing])

  async function requestPlayback({ retry = false } = {}) {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const result = await getMediaPlaybackUrl(media.public_id)
      setPlaybackUrl(result.url)
      setPlaying(true)
      window.dispatchEvent(new CustomEvent(ACTIVE_EVENT, { detail: playerId }))
      if (!retry) retryRef.current = 0
    } catch (requestError) {
      setPlaying(false)
      setError(requestError.message || '实况暂时无法播放。')
    } finally {
      setLoading(false)
    }
  }

  function togglePlayback() {
    const video = videoRef.current
    if (playing && video) {
      video.pause()
      setPlaying(false)
      return
    }
    if (playbackUrl && video) {
      window.dispatchEvent(new CustomEvent(ACTIVE_EVENT, { detail: playerId }))
      setPlaying(true)
      video.play().catch(() => setError('浏览器暂时无法开始播放，请重试。'))
      return
    }
    void requestPlayback()
  }

  function finish() {
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.removeAttribute('src')
      videoRef.current.load()
    }
    setPlaying(false)
    setPlaybackUrl(null)
    retryRef.current = 0
  }

  function playbackFailed() {
    if (retryRef.current < 1) {
      retryRef.current += 1
      setPlaybackUrl(null)
      void requestPlayback({ retry: true })
      return
    }
    finish()
    setError('实况播放失败，请重试。')
  }

  return (
    <div className={`live-photo-player${playing ? ' live-photo-player--playing' : ''}`}>
      {playbackUrl ? (
        <video
          ref={videoRef}
          src={playbackUrl}
          poster={posterUrl || undefined}
          muted={muted}
          playsInline
          preload="metadata"
          onClick={togglePlayback}
          onEnded={finish}
          onError={playbackFailed}
          aria-label={`${title} 的实况`}
        />
      ) : (
        <button type="button" className="live-photo-player__poster" onClick={togglePlayback} disabled={loading} aria-label={`播放${title}的实况`}>
          {posterUrl
            ? <img src={posterUrl} alt={`${title} 的实况封面`} loading={eager ? 'eager' : 'lazy'} width={media.width || undefined} height={media.height || undefined} />
            : <span className="image-placeholder">正在准备实况封面…</span>}
          <span className="live-photo-player__play">{loading ? '正在准备…' : '播放实况'}</span>
        </button>
      )}
      <span className="live-photo-badge">实况</span>
      {durationText(media.duration_ms) && <span className="live-photo-duration">{durationText(media.duration_ms)}</span>}
      {playing && media.has_audio && (
        <button type="button" className="live-photo-player__sound" onClick={() => setMuted((value) => !value)}>
          {muted ? '开启声音' : '关闭声音'}
        </button>
      )}
      {error && <div className="live-photo-player__error" role="alert"><span>{error}</span><button type="button" onClick={() => void requestPlayback()}>重试</button></div>}
    </div>
  )
}
