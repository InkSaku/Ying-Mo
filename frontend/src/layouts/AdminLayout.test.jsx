import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminLayout from './AdminLayout.jsx'

let mockAdminUser

vi.mock('../auth/useAuth.js', () => ({
  useAuth: () => ({ user: mockAdminUser }),
}))

function renderLayout(entry = '/admin/users') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="users" element={<p>用户内容</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminLayout', () => {
  beforeEach(() => {
    mockAdminUser = {
      username: 'admin_user',
      nickname: '映墨管理员',
      role: 'system_admin',
    }
  })

  it('显示当前工作区名称和带说明的分组导航', () => {
    renderLayout()

    expect(screen.getByLabelText('映墨治理后台')).toHaveTextContent('映墨管理后台')
    expect(screen.getByLabelText('当前工作区')).toHaveTextContent('用户')
    expect(screen.getByText('处理社区反馈')).toBeInTheDocument()
    expect(screen.getByText('日常、教材与评论')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '操作日志：高风险操作记录' })).toBeInTheDocument()
    expect(screen.getByText('用户内容')).toBeInTheDocument()
  })

  it('移动导航按钮可以展开侧栏', async () => {
    const interaction = userEvent.setup()
    renderLayout()
    const menuButton = screen.getByRole('button', { name: '打开后台导航' })

    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    await interaction.click(menuButton)

    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
  })
})
