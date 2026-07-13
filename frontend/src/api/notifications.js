import { apiClient } from './client.js'
export const getNotifications = (params) => apiClient.get('/notifications', { params }).then((r) => r.data)
export const getUnreadNotificationCount = () => apiClient.get('/notifications/unread-count').then((r) => r.data.data.count)
export const markNotificationRead = (id) => apiClient.patch(`/notifications/${id}/read`).then((r) => r.data.data)
export const markAllNotificationsRead = () => apiClient.post('/notifications/read-all').then((r) => r.data.data)
