import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import AboutPage from './AboutPage.jsx'

describe('AboutPage', () => {
  it('explains both product spaces and the privacy principle', () => {
    render(<MemoryRouter><AboutPage /></MemoryRouter>)

    expect(screen.getByRole('heading', {
      name: '让日常有回声，让经验有去处。',
    })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '日常生活区' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '游戏点位区' })).toBeInTheDocument()
    expect(screen.getByRole('heading', {
      name: '有些坐标，适合分享；有些只需留给自己。',
    })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '去日常里坐坐' })).toHaveAttribute('href', '/life')
    expect(screen.getByRole('link', { name: '沿地图找点位' })).toHaveAttribute('href', '/games')
  })
})
