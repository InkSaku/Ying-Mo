import { apiClient } from './client.js'

export async function getDrafts(params = {}) {
  const { data } = await apiClient.get('/drafts', { params })
  return { data: data.data, meta: data.meta }
}

export async function getDraft(id) {
  const { data } = await apiClient.get(`/drafts/${id}`)
  return data.data
}

export async function createDraft(payload) {
  const { data } = await apiClient.post('/drafts', payload)
  return data.data
}

export async function updateDraft(id, payload) {
  const { data } = await apiClient.patch(`/drafts/${id}`, payload)
  return data.data
}

export async function deleteDraft(id) {
  await apiClient.delete(`/drafts/${id}`)
}
