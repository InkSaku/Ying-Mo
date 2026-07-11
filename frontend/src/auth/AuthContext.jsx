import { useCallback, useEffect, useRef, useState } from 'react'
import * as authApi from '../api/auth.js'
import { tokenStore } from './tokenStore.js'
import { AuthContext } from './context.js'

const ANONYMOUS_AUTH_CODES = new Set([
  'AUTHENTICATION_REQUIRED',
  'TOKEN_INVALID',
  'TOKEN_EXPIRED',
  'TOKEN_REVOKED',
  'INVALID_TOKEN',
  'MISSING_TOKEN',
])

function isAnonymousAuthError(error) {
  return (
    error?.status === 401
    || ANONYMOUS_AUTH_CODES.has(error?.code)
  )
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('initializing')
  const [user, setUser] = useState(null)

  // 避免 React StrictMode 在开发环境下重复执行初始化请求
  const started = useRef(false)

  const becomeAnonymous = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    setStatus('anonymous')
  }, [])

  const becomeAuthenticated = useCallback((nextUser) => {
    setUser(nextUser)
    setStatus('authenticated')
  }, [])

  const updateAuthenticatedUser = useCallback((nextUser) => {
    setUser(nextUser)
    setStatus('authenticated')
  }, [])

  /**
   * 刷新登录状态。
   *
   * suppressAnonymousError=true 时：
   * 没有 Refresh Cookie、Token 过期或 Token 失效均视为正常未登录，
   * 不再把 401 当成“后端服务未启动”。
   */
  const refreshSession = useCallback(
    async ({ suppressAnonymousError = false } = {}) => {
      try {
        const nextUser = await authApi.refreshSession()

        becomeAuthenticated(nextUser)

        return nextUser
      } catch (error) {
        becomeAnonymous()

        if (
          suppressAnonymousError
          && isAnonymousAuthError(error)
        ) {
          return null
        }

        throw error
      }
    },
    [becomeAnonymous, becomeAuthenticated],
  )

  const login = useCallback(
    async (payload) => {
      const nextUser = await authApi.login(payload)

      becomeAuthenticated(nextUser)

      return nextUser
    },
    [becomeAuthenticated],
  )

  const register = useCallback(
    async (payload) => {
      const nextUser = await authApi.register(payload)

      becomeAuthenticated(nextUser)

      return nextUser
    },
    [becomeAuthenticated],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      // 即使后端 Cookie 已失效或退出接口失败，
      // 前端也必须清除当前登录状态。
      becomeAnonymous()
    }
  }, [becomeAnonymous])

  useEffect(() => {
    if (started.current) {
      return
    }

    started.current = true

    async function initializeAuth() {
      try {
        await refreshSession({
          suppressAnonymousError: true,
        })
      } catch (error) {
        // 运行到这里说明不是普通的未登录 401，
        // 而是真正的网络异常或服务器错误。
        if (import.meta.env.DEV) {
          console.error('恢复登录状态失败：', error)
        }
      }
    }

    void initializeAuth()
  }, [refreshSession])

  const contextValue = {
    status,
    user,
    isAuthenticated: status === 'authenticated',
    login,
    register,
    logout,
    refreshSession,
    updateAuthenticatedUser,
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}
