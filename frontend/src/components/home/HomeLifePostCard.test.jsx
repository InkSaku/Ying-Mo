import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import HomeLifePostCard from './HomeLifePostCard.jsx'

describe('HomeLifePostCard', () => {
  it('keeps the complete featured-post summary available for responsive wrapping', () => {
    const excerpt = '映墨开发日志：生活区的第一次升级。生活，不一定需要一张照片。有时候，文字本身就足够珍贵。'
    const { container } = render(
      <MemoryRouter>
        <HomeLifePostCard
          featured
          post={{
            id: 8,
            title: 'markdown格式',
            excerpt,
            cover_image: '/media/forest.webp',
            cover_width: 1600,
            cover_height: 900,
            author: { nickname: 'Sunmingyuanhahahahahahahaha' },
            created_at: '2026-07-29T05:00:00Z',
          }}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('markdown格式')).toBeInTheDocument()
    expect(screen.getByText(excerpt)).toBeInTheDocument()
    expect(screen.getByText('Sunmingyuanhahahahahahahaha')).toBeInTheDocument()
    expect(container.querySelector('.home-life-card--featured.home-life-card--landscape')).toBeInTheDocument()
  })
})
