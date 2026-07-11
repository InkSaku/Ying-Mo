import { getCookie } from '../auth/cookies.js'
import { tokenStore } from '../auth/tokenStore.js'
import { apiClient } from './client.js'
export { refreshSession } from './authRefresh.js'

function csrfHeaders() {
  const token = getCookie('yingmo_refresh_csrf')
  return token ? { 'X-CSRF-TOKEN': token } : {}
}

export async function register(payload) {
  const { data } = await apiClient.post('/auth/register', payload)
  tokenStore.set(data.data.access_token)
  return data.data.user
}

export async function login(payload) {
  const { data } = await apiClient.post('/auth/login', payload)
  tokenStore.set(data.data.access_token)
  return data.data.user
}


export async function getCurrentUser() {
  const { data } = await apiClient.get('/auth/me')
  return data.data
}

export async function logout() {
  try {
    await apiClient.post('/auth/logout', undefined, { headers: csrfHeaders() })
  } finally {
    tokenStore.clear()
  }
}
