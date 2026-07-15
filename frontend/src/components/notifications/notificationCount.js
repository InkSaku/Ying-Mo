export const NOTIFICATION_COUNT_EVENT = 'yingmo:notification-count'

function dispatch(detail) {
  window.dispatchEvent(new CustomEvent(NOTIFICATION_COUNT_EVENT, { detail }))
}

export function setNotificationCount(count) {
  dispatch({ type: 'set', count: Math.max(0, Number(count) || 0) })
}

export function decreaseNotificationCount(amount = 1) {
  dispatch({ type: 'decrease', amount: Math.max(1, Number(amount) || 1) })
}

export function refreshNotificationCount() {
  dispatch({ type: 'refresh' })
}
