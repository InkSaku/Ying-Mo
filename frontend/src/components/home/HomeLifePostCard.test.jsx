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
          layout="lead"
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
    expect(container.querySelector('.home-life-card--featured.home-life-card--landscape.home-life-card--layout-lead'))
      .toBeInTheDocument()
    expect(screen.getByRole('link', { name: /查看Sunmingyuan.*的生活记录/ }))
      .toHaveAttribute('href', '/life/post/8')
    expect(screen.getByRole('img', { name: '生活照片：markdown格式' }))
      .toHaveAttribute('src', '/media/forest.webp')
    expect(screen.queryByText('打开记录')).not.toBeInTheDocument()
  })

  it('shows media quantity as quiet metadata instead of an image overlay pill', () => {
    const { container } = render(
      <MemoryRouter>
        <HomeLifePostCard
          post={{
            id: 9,
            title: '四月散步',
            excerpt: '天黑之前走过河边。',
            cover_image: '/media/walk.webp',
            media_count: 3,
            chapter: { name: '散步' },
            author: { nickname: '映墨' },
            created_at: '2026-04-20T05:00:00Z',
          }}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('3 张照片')).toBeInTheDocument()
    expect(container.querySelector('.home-life-card__image-count')).not.toBeInTheDocument()
  })
})
