import { apiClient } from './client.js'

export const getNotifications = (params = {}, signal) => (
  apiClient.get('/notifications', { params, signal }).then((response) => response.data)
)

export const getUnreadNotificationCount = (signal) => (
  apiClient.get('/notifications/unread-count', { signal }).then((response) => response.data.data.count)
)

export const markNotificationRead = (id) => (
  apiClient.patch(`/notifications/${id}/read`).then((response) => response.data.data)
)

export const markAllNotificationsRead = () => (
  apiClient.post('/notifications/read-all').then((response) => response.data.data)
)
