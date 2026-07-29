import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AuthContext } from '../../auth/context.js'
import SiteHeader from './SiteHeader.jsx'

describe('SiteHeader primary navigation', () => {
  it('keeps high-frequency destinations and leaves About to the footer', () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={{
          isAuthenticated: false,
          user: null,
          logout: vi.fn(),
        }}>
          <SiteHeader theme="light" onThemeToggle={vi.fn()} />
        </AuthContext.Provider>
      </MemoryRouter>,
    )

    const navigation = within(screen.getByRole('navigation', { name: '主要导航' }))
    expect(navigation.getByRole('link', { name: '首页' })).toBeInTheDocument()
    expect(navigation.getByRole('link', { name: '日常' })).toBeInTheDocument()
    expect(navigation.getByRole('link', { name: '游戏点位' })).toBeInTheDocument()
    expect(navigation.getByRole('link', { name: '发现' })).toBeInTheDocument()
    expect(navigation.getByRole('link', { name: '发布' })).toBeInTheDocument()
    expect(navigation.queryByRole('link', { name: '关于' })).not.toBeInTheDocument()
  })
})
