import { apiClient } from './client.js'

export async function uploadImage(file, purpose = 'content') {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('purpose', purpose)
  const { data } = await apiClient.post('/uploads/images', formData)
  return data.data
}

export async function deleteUnboundImage(publicId) {
  await apiClient.delete(`/uploads/images/${encodeURIComponent(publicId)}`)
}
