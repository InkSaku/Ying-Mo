import { apiClient } from './client.js'

export async function getNearbyLocations(payload, signal) {
  const { data } = await apiClient.post('/locations/nearby', payload, { signal })
  return data.data
}

export async function getLocationSuggestions(payload, signal) {
  const { data } = await apiClient.post('/locations/suggestions', payload, { signal })
  return data.data
}
