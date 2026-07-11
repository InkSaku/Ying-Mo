import { apiClient } from './client.js'

function params(config) { return { params: Object.fromEntries(Object.entries(config || {}).filter(([, value]) => value !== '' && value != null)) } }
export async function getLifeChapters(query) { const { data } = await apiClient.get('/life/chapters', params(query)); return data }
export async function checkLifeChapterName(query) { const { data } = await apiClient.get('/life/chapters/check-name', params(query)); return data.data }
export async function createLifeChapter(payload) { const { data } = await apiClient.post('/life/chapters', payload); return data.data }
export async function getLifeChapter(slug) { const { data } = await apiClient.get(`/life/chapters/${encodeURIComponent(slug)}`); return data.data }
export async function getLifePosts(query) { const { data } = await apiClient.get('/life/posts', params(query)); return data }
export async function getLifePost(id) { const { data } = await apiClient.get(`/life/posts/${id}`); return data.data }
export async function createLifePost(payload) { const { data } = await apiClient.post('/life/posts', payload); return data.data }
export async function updateLifePost(id, payload) { const { data } = await apiClient.patch(`/life/posts/${id}`, payload); return data.data }
export async function deleteLifePost(id) { await apiClient.delete(`/life/posts/${id}`) }
