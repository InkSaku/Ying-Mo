export const NOTIFICATION_COUNT_EVENT = 'yingmo:notification-count'

export function setNotificationCount(count) {
  window.dispatchEvent(new CustomEvent(NOTIFICATION_COUNT_EVENT, { detail: Math.max(0, Number(count) || 0) }))
}

export function decreaseNotificationCount() {
  window.dispatchEvent(new CustomEvent(NOTIFICATION_COUNT_EVENT, { detail: 'decrease' }))
}
