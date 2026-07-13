import { apiClient } from './client.js'

export async function getDiscover() {
  const { data } = await apiClient.get('/discover')
  return data.data
}
