import { apiClient } from './client.js'

export async function uploadImage(file, purpose = 'content', signal) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('purpose', purpose)
  const { data } = await apiClient.post('/uploads/images', formData, { signal })
  return data.data
}

export async function uploadLiveVideo(file, { signal, onUploadProgress } = {}) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('media_type', 'live_video')
  formData.append('purpose', 'content')
  const { data } = await apiClient.post('/uploads/media', formData, {
    signal,
    onUploadProgress,
    timeout: 120_000,
  })
  return data.data
}

export async function getMediaPlaybackUrl(publicId) {
  const { data } = await apiClient.get(`/uploads/media/${encodeURIComponent(publicId)}/playback-url`)
  return data.data
}

export async function deleteUnboundImage(publicId) {
  await apiClient.delete(`/uploads/images/${encodeURIComponent(publicId)}`)
}

export async function deleteUnboundMedia(publicId) {
  await apiClient.delete(`/uploads/media/${encodeURIComponent(publicId)}`)
}

export async function fetchImageBlob(url, signal) {
  const requestUrl = url.startsWith('/api/v1/') ? url.slice('/api/v1'.length) : url
  const { data } = await apiClient.get(requestUrl, { responseType: 'blob', signal })
  return data
}
