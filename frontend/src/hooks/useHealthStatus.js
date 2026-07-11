import { useCallback, useEffect, useRef, useState } from 'react'
import { getHealthStatus } from '../api/health'

const INITIAL_STATE = {
  status: 'loading',
  health: null,
  error: null,
}

export default function useHealthStatus() {
  const [state, setState] = useState(INITIAL_STATE)
  const mountedRef = useRef(false)
  const hasInitializedRef = useRef(false)
  const requestIdRef = useRef(0)

  const checkHealth = useCallback(async () => {
    const requestId = requestIdRef.current + 1

    requestIdRef.current = requestId
    setState({ status: 'loading', health: null, error: null })

    try {
      const health = await getHealthStatus()
      if (!mountedRef.current || requestId !== requestIdRef.current) return
      setState({ status: 'success', health, error: null })
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return
      }
      if (import.meta.env.DEV) {
        console.error('Yingmo health check failed:', error.code)
      }
      setState({ status: 'error', health: null, error })
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      void Promise.resolve().then(() => {
        if (mountedRef.current) {
          return checkHealth()
        }
        return undefined
      })
    }

    return () => {
      mountedRef.current = false
    }
  }, [checkHealth])

  return { ...state, checkHealth }
}
