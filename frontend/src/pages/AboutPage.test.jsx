import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import AboutPage from './AboutPage.jsx'

describe('AboutPage', () => {
  it('explains both product spaces and the privacy principle', () => {
    render(<MemoryRouter><AboutPage /></MemoryRouter>)

    expect(screen.getByRole('heading', {
      name: '把普通日子和有用经验，认真留在这里。',
    })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '日常生活区' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '游戏点位区' })).toBeInTheDocument()
    expect(screen.getByRole('heading', {
      name: '是否公开、公开到什么程度，应当由记录者决定。',
    })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '看看真实日常' })).toHaveAttribute('href', '/life')
    expect(screen.getByRole('link', { name: '进入游戏点位' })).toHaveAttribute('href', '/games')
  })
})
