import { apiClient } from './client.js'

export async function createReport(payload) {
  const { data } = await apiClient.post('/reports', payload)
  return data.data
}
