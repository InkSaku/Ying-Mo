import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as admin from '../api/admin.js'
import { AdminUserDetailPage, AdminUsersPage } from './AdminPages.jsx'

vi.mock('../api/admin.js', () => ({
  getAdminUsers: vi.fn(),
  getAdminUser: vi.fn(),
  updateUserRestrictions: vi.fn(),
  updateUserStatus: vi.fn(),
  updateUserRole: vi.fn(),
}))

vi.mock('../auth/useAuth.js', () => ({
  useAuth: () => ({ user: { role: 'system_admin' } }),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminUsersPage />
    </MemoryRouter>,
  )
}

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('用结构化列表展示身份、状态和内容权限', async () => {
    admin.getAdminUsers.mockResolvedValue({
      data: [{
        id: 8,
        username: 'ink_admin',
        nickname: '映墨管理员',
        avatar_url: 'https://example.com/avatar.jpg',
        role: 'content_admin',
        status: 'active',
        can_publish: true,
        can_comment: false,
      }],
      meta: {},
    })
    renderPage()

    expect(await screen.findByText('映墨管理员')).toBeInTheDocument()
    const result = within(screen.getByLabelText('用户筛选结果'))
    expect(result.getByText('@ink_admin')).toBeInTheDocument()
    expect(result.getByText('内容管理员')).toBeInTheDocument()
    expect(result.getByText('发布 允许')).toBeInTheDocument()
    expect(result.getByText('评论 限制')).toHaveClass('is-restricted')
    expect(result.getByText('筛选结果').parentElement).toHaveTextContent('1')
    expect(result.getByRole('listitem')).toHaveAttribute('href', '/admin/users/8')
    expect(result.getByRole('img', { name: '映墨管理员头像' })).toHaveAttribute('src', 'https://example.com/avatar.jpg')
  })

  it('在用户档案中继续显示头像', async () => {
    admin.getAdminUser.mockResolvedValue({
      id: 8,
      username: 'ink_admin',
      nickname: '映墨管理员',
      email: 'admin@example.com',
      avatar_url: 'https://example.com/avatar-detail.jpg',
      role: 'content_admin',
      status: 'active',
      can_publish: true,
      can_comment: true,
      can_manage: true,
    })

    render(
      <MemoryRouter initialEntries={['/admin/users/8']}>
        <Routes><Route path="/admin/users/:id" element={<AdminUserDetailPage />} /></Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('img', { name: '映墨管理员头像' })).toHaveAttribute('src', 'https://example.com/avatar-detail.jpg')
  })

  it('没有匹配用户时给出可操作的空状态', async () => {
    admin.getAdminUsers.mockResolvedValue({ data: [], meta: {} })
    renderPage()

    expect(await screen.findByText('没有找到符合条件的用户')).toBeInTheDocument()
    expect(screen.getByText('可以调整关键词、角色或状态后重新筛选。')).toBeInTheDocument()
  })
})
