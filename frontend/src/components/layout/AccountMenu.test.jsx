import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import AccountMenu from './AccountMenu'

const user = {
  username: 'ink_user',
  nickname: '映墨用户',
  avatar_url: null,
}

function renderMenu(overrides = {}) {
  const props = {
    user,
    isAdmin: true,
    isLoggingOut: false,
    onLogout: vi.fn().mockResolvedValue(undefined),
    onNavigate: vi.fn(),
    ...overrides,
  }

  render(
    <MemoryRouter>
      <AccountMenu {...props} />
    </MemoryRouter>,
  )

  return props
}

describe('AccountMenu', () => {
  it('将账户相关入口收纳到头像下拉菜单中', async () => {
    const interaction = userEvent.setup()
    const props = renderMenu()

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /个人中心/ })).not.toBeInTheDocument()

    await interaction.click(screen.getByRole('button', { name: '打开映墨用户的账户菜单' }))

    expect(screen.getByRole('menu', { name: '账户菜单' })).toBeInTheDocument()
    expect(screen.getByText('映墨用户')).toBeInTheDocument()
    expect(screen.getByText('@ink_user')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /我的主页/ })).toHaveAttribute(
      'href',
      '/user/ink_user',
    )
    expect(screen.getByRole('menuitem', { name: /个人中心/ })).toHaveAttribute('href', '/me')
    expect(screen.getByRole('menuitem', { name: /管理后台/ })).toHaveAttribute('href', '/admin')

    await interaction.click(screen.getByRole('menuitem', { name: /个人中心/ }))

    expect(props.onNavigate).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('支持方向键导航、Escape 关闭和退出登录', async () => {
    const interaction = userEvent.setup()
    const props = renderMenu()
    const trigger = screen.getByRole('button', { name: '打开映墨用户的账户菜单' })

    trigger.focus()
    await interaction.keyboard('{ArrowDown}')

    const homeLink = await screen.findByRole('menuitem', { name: /我的主页/ })
    await waitFor(() => expect(homeLink).toHaveFocus())

    await interaction.keyboard('{End}')
    const logoutButton = screen.getByRole('menuitem', { name: '退出登录' })
    expect(logoutButton).toHaveFocus()

    await interaction.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    await interaction.click(trigger)
    await interaction.click(screen.getByRole('menuitem', { name: '退出登录' }))

    expect(props.onLogout).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('点击菜单外部时关闭', async () => {
    const interaction = userEvent.setup()
    renderMenu({ isAdmin: false })

    await interaction.click(screen.getByRole('button', { name: '打开映墨用户的账户菜单' }))
    expect(screen.queryByRole('menuitem', { name: /管理后台/ })).not.toBeInTheDocument()

    fireEvent.pointerDown(document.body)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
