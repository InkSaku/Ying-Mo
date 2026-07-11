import { apiClient } from './client.js'

export async function getPublicUser(username) {
  const { data } = await apiClient.get(`/users/${encodeURIComponent(username)}`)
  return data.data
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
