import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getNotifications,
  getUnreadNotificationCount,
} from '../../api/notifications.js'
import NotificationBell from './NotificationBell.jsx'
import { setNotificationCount } from './notificationCount.js'

vi.mock('../../api/notifications.js', () => ({
  getNotifications: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  getNotifications.mockResolvedValue({ data: [] })
})

describe('notification bell', () => {
  it('keeps a visible new-message label while unread notifications exist', async () => {
    getUnreadNotificationCount.mockResolvedValue(4)
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    const link = await screen.findByRole('link', { name: '4 条未读通知' })
    expect(link).toHaveClass('has-unread')
    expect(link).toHaveTextContent('新消息')
    expect(link).toHaveTextContent('4')
  })

  it('updates the persistent indicator when other notification views sync the count', async () => {
    getUnreadNotificationCount.mockResolvedValue(0)
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('link', { name: '通知中心，没有未读消息' })).toBeInTheDocument()
    act(() => setNotificationCount(2))

    expect(screen.getByRole('link', { name: '2 条未读通知' })).toHaveTextContent('新消息2')
  })
})
