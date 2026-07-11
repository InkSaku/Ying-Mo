import axios from 'axios'
import { toApiError } from '../utils/apiError.js'
import { tokenStore } from '../auth/tokenStore.js'
import { refreshSession } from './authRefresh.js'

const DEFAULT_API_BASE_URL = '/api/v1'
const API_BASE_URL = import.meta.env.DEV
  ? DEFAULT_API_BASE_URL
  : (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL)
const REFRESH_EXCLUDED_ENDPOINTS = new Set([
  '/health',
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
])

function endpointPath(url = '') {
  return url.split('?')[0]
}

function shouldSkipAuthRefresh(config) {
  return config?.skipAuthRefresh || REFRESH_EXCLUDED_ENDPOINTS.has(endpointPath(config?.url))
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
})

apiClient.interceptors.request.use(
  (config) => {
    const token = tokenStore.get()
    if (token && !shouldSkipAuthRefresh(config)) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(toApiError(error)),
)

let refreshPromise = null

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (
      error.response?.status === 401
      && !shouldSkipAuthRefresh(originalRequest)
      && !originalRequest?._retry
    ) {
      originalRequest._retry = true
      try {
        if (!refreshPromise) {
          refreshPromise = refreshSession().finally(() => { refreshPromise = null })
        }
        await refreshPromise
        return apiClient(originalRequest)
      } catch (refreshError) {
        tokenStore.clear()
        return Promise.reject(toApiError(refreshError))
      }
    }
    return Promise.reject(toApiError(error))
  },
)
