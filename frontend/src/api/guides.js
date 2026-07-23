import { apiClient } from './client.js'
function params(query) { return { params: Object.fromEntries(Object.entries(query || {}).filter(([, value]) => value !== '' && value != null)) } }
export async function getGuides(query, signal) { const { data } = await apiClient.get('/guides', { ...params(query), signal }); return data }
export async function getGuide(id) { const { data } = await apiClient.get(`/guides/${id}`); return data.data }
export async function createGuide(payload) { const { data } = await apiClient.post('/guides', payload); return data.data }
export async function updateGuide(id, payload) { const { data } = await apiClient.patch(`/guides/${id}`, payload); return data.data }
export async function deleteGuide(id) { await apiClient.delete(`/guides/${id}`) }
export async function setGuideValidityFeedback(id, feedback_type) { const { data } = await apiClient.put(`/guides/${id}/validity-feedback`, { feedback_type }); return data.data }
