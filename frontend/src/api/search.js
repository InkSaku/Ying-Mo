import { apiClient } from './client.js'

function params(values) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== '' && value !== null && value !== undefined))
}

export async function searchAll(values) {
  const { data } = await apiClient.get('/search', { params: params({ ...values, scope: 'all' }) })
  return data.data
}

export async function searchByScope(values) {
  const { data } = await apiClient.get('/search', { params: params(values) })
  return { data: data.data, meta: data.meta }
}

export async function getSearchSuggestions(q, limit = 8, signal) {
  const { data } = await apiClient.get('/search/suggestions', { params: { q, limit }, signal })
  return data.data
}
