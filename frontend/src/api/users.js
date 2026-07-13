import { apiClient } from './client.js'

export async function getPublicUser(username) {
  const { data } = await apiClient.get(`/users/${encodeURIComponent(username)}`)
  return data.data
}

export async function getPublicUserLifePosts(username, params = {}) {
  const { data } = await apiClient.get(`/users/${encodeURIComponent(username)}/life-posts`, { params })
  return { data: data.data, meta: data.meta }
}

export async function getPublicUserGuides(username, params = {}) {
  const { data } = await apiClient.get(`/users/${encodeURIComponent(username)}/guides`, { params })
  return { data: data.data, meta: data.meta }
}

export async function getMySummary() {
  const { data } = await apiClient.get('/users/me/summary')
  return data.data
}

export async function getMyLifePosts(params = {}) {
  const { data } = await apiClient.get('/users/me/life-posts', { params })
  return { data: data.data, meta: data.meta }
}

export async function getMyGuides(params = {}) {
  const { data } = await apiClient.get('/users/me/guides', { params })
  return { data: data.data, meta: data.meta }
}

export async function getMyChapterSubmissions(params = {}) {
  const { data } = await apiClient.get('/users/me/chapter-submissions', { params })
  return { data: data.data, meta: data.meta }
}

export async function updateCurrentUser(payload) {
  const { data } = await apiClient.patch('/users/me', payload)
  return data.data
}

export async function setCurrentUserAvatar(mediaId) {
  const { data } = await apiClient.put('/users/me/avatar', { media_id: mediaId })
  return data.data
}

export async function removeCurrentUserAvatar() {
  await apiClient.delete('/users/me/avatar')
}
