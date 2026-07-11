import axios from 'axios'
import { getCookie } from '../auth/cookies.js'
import { tokenStore } from '../auth/tokenStore.js'
import { toApiError } from '../utils/apiError.js'

const DEFAULT_API_BASE_URL = '/api/v1'
const API_BASE_URL = import.meta.env.DEV
  ? DEFAULT_API_BASE_URL
  : (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL)

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  withCredentials: true,
  headers: { Accept: 'application/json' },
})

export async function refreshSession() {
  const csrf = getCookie('yingmo_refresh_csrf')
  try {
    const { data } = await refreshClient.post('/auth/refresh', undefined, {
      headers: csrf ? { 'X-CSRF-TOKEN': csrf } : {},
    })
    tokenStore.set(data.data.access_token)
    return data.data.user
  } catch (error) {
    throw toApiError(error)
  }
}
