import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import PublishPage from './PublishPage.jsx'

describe('PublishPage', () => {
  it('offers the two supported publishing paths', () => {
    render(<MemoryRouter><PublishPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: '选择一种创作方式' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '发布生活：记录生活' }))
      .toHaveAttribute('href', '/life/create')
    expect(screen.getByRole('link', { name: '发布点位：分享游戏点位' }))
      .toHaveAttribute('href', '/guide/create')
  })

  it('gives life and guide creation distinct content structures', () => {
    const view = render(<MemoryRouter><PublishPage /></MemoryRouter>)

    const lifeEntry = view.container.querySelector('.publish-life-entry')
    const gameEntry = view.container.querySelector('.publish-game-entry')
    expect(lifeEntry).toContainElement(screen.getByRole('heading', { name: '记录生活' }))
    expect(lifeEntry.querySelector('img')).toHaveAttribute('src', '/assets/gallery/photo-07.jpg')
    expect(gameEntry).toContainElement(screen.getByRole('heading', { name: '分享游戏点位' }))

    const route = screen.getByRole('list', { name: '点位发布内容顺序' })
    expect(within(route).getAllByRole('listitem')).toHaveLength(3)
    expect(within(route).getByText('地图')).toBeInTheDocument()
    expect(within(route).getByText('英雄')).toBeInTheDocument()
    expect(within(route).getByText('点位')).toBeInTheDocument()
  })

  it('removes template numbering, decorative English, and tag stacks', () => {
    render(<MemoryRouter><PublishPage /></MemoryRouter>)

    expect(screen.queryByText('01')).not.toBeInTheDocument()
    expect(screen.queryByText('02')).not.toBeInTheDocument()
    expect(screen.queryByText('MEMORY')).not.toBeInTheDocument()
    expect(screen.queryByText('COORDINATE')).not.toBeInTheDocument()
    expect(screen.queryByText('照片与文字')).not.toBeInTheDocument()
    expect(screen.queryByText('实战验证')).not.toBeInTheDocument()
  })
})
