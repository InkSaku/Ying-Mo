import { apiClient } from './client.js'
export const getInteractionSummary = (type, id) => apiClient.get(`/interactions/${type}/${id}`).then((r) => r.data.data)
export const likeTarget = (type, id) => apiClient.put(`/interactions/${type}/${id}/like`).then((r) => r.data.data)
export const unlikeTarget = (type, id) => apiClient.delete(`/interactions/${type}/${id}/like`).then((r) => r.data.data)
export const favoriteTarget = (type, id) => apiClient.put(`/interactions/${type}/${id}/favorite`).then((r) => r.data.data)
export const unfavoriteTarget = (type, id) => apiClient.delete(`/interactions/${type}/${id}/favorite`).then((r) => r.data.data)
export const getFavorites = (params) => apiClient.get('/interactions/favorites', { params }).then((r) => r.data)
