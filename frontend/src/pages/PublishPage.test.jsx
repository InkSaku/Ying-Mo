import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import PublishPage from './PublishPage.jsx'

describe('PublishPage', () => {
  it('offers the two supported publishing paths', () => {
    render(<MemoryRouter><PublishPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: '今天，想留下什么？' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '写下此刻：留下一段日常' }))
      .toHaveAttribute('href', '/life/create')
    expect(screen.getByRole('link', { name: '留下路标：留下一处点位' }))
      .toHaveAttribute('href', '/guide/create')
  })
})
