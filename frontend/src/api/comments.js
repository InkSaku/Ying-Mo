import { apiClient } from './client.js'
export const getComments = (params) => apiClient.get('/comments', { params }).then((r) => r.data)
export const getCommentReplies = (id, params) => apiClient.get(`/comments/${id}/replies`, { params }).then((r) => r.data)
export const createComment = (payload) => apiClient.post('/comments', payload).then((r) => r.data.data)
export const deleteComment = (id) => apiClient.delete(`/comments/${id}`)
export const getMyComments = (params) => apiClient.get('/comments/me', { params }).then((r) => r.data)
