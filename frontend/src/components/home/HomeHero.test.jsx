import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import HomeHero from './HomeHero.jsx'

vi.mock('./YingmoConstellationCanvas.jsx', () => ({
  default: () => <canvas data-testid="home-constellations" />,
}))

const posts = [
  {
    id: 1,
    title: '雨后的街角',
    excerpt: '路灯在积水里留下第二层光。',
    cover_image: '/media/rain.webp',
    cover_width: 1600,
    cover_height: 900,
    chapter: { name: '城市散步' },
    author: { nickname: '小映' },
    created_at: '2026-08-01T08:00:00Z',
  },
  {
    id: 2,
    title: '山里的午后',
    excerpt: '风从树梢一路落到石阶。',
    cover_image: '/media/mountain.webp',
    author: { nickname: '阿墨' },
    created_at: '2026-08-02T08:00:00Z',
  },
]

const data = {
  posts,
  chapters: [{ id: 3, slug: 'summer', name: '夏日', content_count: 7, contributor_count: 3 }],
  games: [{ id: 4, slug: 'overwatch', name_zh: '守望先锋', map_count: 21, hero_count: 43 }],
  guides: [{
    id: 5,
    title: '国王大道拐角睡眠针',
    excerpt: '从拐角外侧瞄准墙面标记。',
    cover_image: '/media/guide.webp',
    map: { name_zh: '国王大道' },
    hero: { name_zh: '安娜' },
  }],
}

function renderHero(props = {}) {
  return render(
    <MemoryRouter>
      <HomeHero
        latestPost={posts[0]}
        latestGame={data.games[0]}
        loading={false}
        visualData={data}
        {...props}
      />
    </MemoryRouter>,
  )
}

describe('HomeHero story rail', () => {
  it('builds a five-card rail from real home data and keeps only the active card interactive', () => {
    const { container } = renderHero()

    expect(screen.getByRole('region', { name: '映墨新近内容' })).toHaveAttribute('aria-roledescription', '轮播')
    expect(container.querySelectorAll('.home-story-slide')).toHaveLength(5)

    const active = container.querySelector('.home-story-slide.is-active')
    expect(active).toHaveClass('home-story-slide--life')
    expect(within(active).getByRole('link', { name: '生活记录：雨后的街角' }))
      .toHaveAttribute('href', '/life/post/1')
    expect(within(active).getByText('城市散步 · 8月1日')).toBeInTheDocument()
    expect(active.querySelector('.home-story-slide__media-backdrop')).toHaveAttribute('aria-hidden', 'true')
    expect(active.querySelector('.home-story-slide__media-backdrop .adaptive-media')).toHaveClass('adaptive-media--cover')
    expect(active.querySelector('.home-story-slide__media-foreground .adaptive-media')).toHaveClass('adaptive-media--contain')
    expect(within(active).getAllByRole('img')).toHaveLength(1)

    const inactiveLinks = [...container.querySelectorAll('.home-story-slide:not(.is-active) a')]
    expect(inactiveLinks.every((link) => link.tabIndex === -1)).toBe(true)
  })

  it('moves through the rail with explicit controls and preserves destination routes', async () => {
    const user = userEvent.setup()
    const { container } = renderHero()

    await user.click(screen.getByRole('button', { name: '查看下一项' }))

    const active = container.querySelector('.home-story-slide.is-active')
    expect(active).toHaveClass('home-story-slide--guide')
    expect(within(active).getByRole('link', { name: '游戏点位：国王大道拐角睡眠针' }))
      .toHaveAttribute('href', '/guide/5')
    expect(within(active).getByText('国王大道 · 安娜')).toBeInTheDocument()
  })

  it('advances automatically after 3.8 seconds and pauses while hovered', () => {
    vi.useFakeTimers()
    try {
      const { container } = renderHero()
      const rail = screen.getByRole('region', { name: '映墨新近内容' })

      expect(container.querySelector('.home-story-slide.is-active')).toHaveClass('home-story-slide--life')

      fireEvent.mouseEnter(rail)
      act(() => { vi.advanceTimersByTime(3800) })
      expect(container.querySelector('.home-story-slide.is-active')).toHaveClass('home-story-slide--life')

      fireEvent.mouseLeave(rail)
      act(() => { vi.advanceTimersByTime(3800) })
      expect(container.querySelector('.home-story-slide.is-active')).toHaveClass('home-story-slide--guide')
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps a shaped loading state and disables navigation until content is ready', () => {
    renderHero({ loading: true })

    expect(screen.getByRole('status', { name: '正在读取社区新近内容' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看上一项' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '查看下一项' })).toBeDisabled()
  })

  it('shows honest dual-space empty states without mock business content', async () => {
    const user = userEvent.setup()
    const { container } = renderHero({ latestPost: undefined, latestGame: undefined, visualData: { posts: [], chapters: [], games: [], guides: [] } })

    let active = container.querySelector('.home-story-slide.is-active')
    expect(within(active).getByRole('link', { name: '生活记录：这里还空着一页' })).toHaveAttribute('href', '/life')

    await user.click(screen.getByRole('button', { name: '查看下一项' }))
    active = container.querySelector('.home-story-slide.is-active')
    expect(within(active).getByRole('link', { name: '地图目录：路标还在准备' })).toHaveAttribute('href', '/games')
  })
})
