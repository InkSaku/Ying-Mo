import { useEffect, useState } from 'react'
import { fetchImageBlob } from '../api/uploads.js'

function needsAuthenticatedFetch(source) {
  return typeof source === 'string' && source.startsWith('/api/v1/uploads/images/')
}

export default function useAuthenticatedImageUrl(source) {
  const requiresAuthentication = needsAuthenticatedFetch(source)
  const [resolved, setResolved] = useState({ source: null, url: null, error: null })

  useEffect(() => {
    if (!source || !requiresAuthentication) return undefined

    const controller = new AbortController()
    let objectUrl = null
    let active = true

    fetchImageBlob(source, controller.signal)
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setResolved({ source, url: objectUrl, error: null })
      })
      .catch((error) => {
        if (!active || error?.code === 'ERR_CANCELED' || error?.name === 'AbortError') return
        setResolved({ source, url: null, error })
      })

    return () => {
      active = false
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [requiresAuthentication, source])

  if (!source) return { url: null, loading: false, error: null }
  if (!requiresAuthentication) return { url: source, loading: false, error: null }
  if (resolved.source !== source) return { url: null, loading: true, error: null }
  return { url: resolved.url, loading: false, error: resolved.error }
}
