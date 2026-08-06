import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getGames } from '../api/games.js'
import { getGuides } from '../api/guides.js'
import { getLifeChapters, getLifePosts } from '../api/life.js'
import HomePage from './HomePage.jsx'

vi.mock('../api/games.js', () => ({ getGames: vi.fn() }))
vi.mock('../api/guides.js', () => ({ getGuides: vi.fn() }))
vi.mock('../api/life.js', () => ({
  getLifeChapters: vi.fn(),
  getLifePosts: vi.fn(),
}))

vi.mock('../components/home/HomeHero', () => ({
  default: () => <div data-testid="home-hero" />,
}))
vi.mock('../components/home/ProductSpaceSection', () => ({
  default: () => <div data-testid="product-space" />,
}))
vi.mock('../components/motion/Reveal.jsx', () => ({
  default: ({ children, className = '' }) => <div className={className}>{children}</div>,
}))

const posts = Array.from({ length: 4 }, (_, index) => ({
  id: index + 1,
  title: `生活记录 ${index + 1}`,
  excerpt: `第 ${index + 1} 条记录`,
  cover_image: `/media/life-${index + 1}.webp`,
  cover_width: index === 1 ? 900 : 1600,
  cover_height: index === 1 ? 1600 : 900,
  author: { nickname: '映墨' },
  created_at: '2026-08-01T08:00:00Z',
}))

const chapters = [
  { id: 11, slug: 'summer', name: '夏日', content_count: 3, contributor_count: 2 },
  { id: 12, slug: 'walking', name: '散步', content_count: 5, contributor_count: 1 },
]

function renderPage() {
  return render(<MemoryRouter><HomePage /></MemoryRouter>)
}

describe('HomePage life section', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getLifePosts.mockResolvedValue({ data: posts })
    getLifeChapters.mockResolvedValue({ data: chapters })
    getGames.mockResolvedValue({ data: [] })
    getGuides.mockResolvedValue({ data: [] })
  })

  it('keeps the existing requests and routes while presenting an editorial photo flow', async () => {
    const { container } = renderPage()

    await screen.findByRole('heading', { name: '最近的生活' })

    expect(getLifePosts).toHaveBeenCalledWith({ page: 1, page_size: 4, scope: 'latest' })
    expect(getLifeChapters).toHaveBeenCalledWith({ page: 1, page_size: 5, sort: 'popular' })
    expect(getGames).toHaveBeenCalledWith({ page: 1, page_size: 4, sort: 'latest' })
    expect(getGuides).toHaveBeenCalledWith({ page: 1, page_size: 3, sort: 'latest' })

    expect(screen.getByRole('link', { name: /查看全部日常/ })).toHaveAttribute('href', '/life')
    posts.forEach((post) => {
      expect(screen.getByRole('link', { name: new RegExp(`生活记录：${post.title}`) }))
        .toHaveAttribute('href', `/life/post/${post.id}`)
    })
    expect(screen.getByRole('link', { name: /全部生活章节/ })).toHaveAttribute('href', '/life/chapters')
    expect(screen.getByRole('link', { name: /^夏日/ })).toHaveAttribute('href', '/life/chapter/summer')

    expect(container.querySelectorAll('.home-life-showcase__item')).toHaveLength(4)
    expect(container.querySelector('.home-life-showcase__item--lead')).toBeInTheDocument()
    expect(container.querySelector('.home-life-showcase__item--side')).toBeInTheDocument()
    expect(container.querySelector('.home-life-showcase__item--lower-left')).toBeInTheDocument()
    expect(container.querySelector('.home-life-showcase__item--lower-right')).toBeInTheDocument()
    expect(container.querySelector('.home-life-layout')).not.toBeInTheDocument()
    expect(screen.queryByText('日常 · 新近留下')).not.toBeInTheDocument()
  })

  it('keeps loading, error, and empty feedback for life content', async () => {
    getLifePosts.mockImplementation(() => new Promise(() => {}))
    getLifeChapters.mockImplementation(() => new Promise(() => {}))
    getGames.mockImplementation(() => new Promise(() => {}))
    getGuides.mockImplementation(() => new Promise(() => {}))
    const loadingView = renderPage()
    expect(screen.getByRole('status', { name: '正在读取生活记录' })).toBeInTheDocument()
    loadingView.unmount()

    getLifePosts.mockRejectedValue(new Error('生活内容暂时离线'))
    getLifeChapters.mockResolvedValue({ data: chapters })
    getGames.mockResolvedValue({ data: [] })
    getGuides.mockResolvedValue({ data: [] })
    const errorView = renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('生活内容暂时离线')
    errorView.unmount()

    getLifePosts.mockResolvedValue({ data: [] })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('这里还空着，等一张照片或一句当时的话。')).toBeInTheDocument()
    })
  })

  it('keeps chapter summaries available in the quieter collection index', async () => {
    renderPage()

    const chapterRegion = await screen.findByRole('complementary', { name: '按合集继续翻看' })
    expect(within(chapterRegion).getByText('3 条记录 · 2 位参与者')).toBeInTheDocument()
    expect(within(chapterRegion).getByText('5 条记录 · 1 位参与者')).toBeInTheDocument()
  })
})
