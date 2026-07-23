import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getGames } from '../api/games.js'
import GamesPage from './GamesPage.jsx'


vi.mock('../api/games.js', () => ({
  getGames: vi.fn(),
}))


function game(id, overrides = {}) {
  return {
    id,
    slug: `game-${id}`,
    name_zh: `游戏${id}`,
    name_en: `Game ${id}`,
    description: `游戏${id}的地图点位目录。`,
    current_version: `v${id}`,
    hero_count: id + 2,
    map_count: id + 1,
    active_hero_count: id + 2,
    usable_map_count: id + 1,
    guide_count: id * 3,
    cover_thumbnail_url: null,
    icon_thumbnail_url: null,
    ...overrides,
  }
}


function result(data, overrides = {}) {
  return {
    data,
    meta: {
      pagination: {
        page: 1,
        page_size: 12,
        total: data.length,
        total_pages: 1,
        has_next: false,
        has_previous: false,
        ...overrides,
      },
    },
  }
}


function renderGames(entry = '/games') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/games" element={<GamesPage />} />
        <Route path="/game/:gameSlug/maps" element={<p>已进入地图目录</p>} />
      </Routes>
    </MemoryRouter>,
  )
}


beforeEach(() => {
  vi.clearAllMocks()
})


describe('GamesPage', () => {
  it('shows the complete public empty state when no game is active', async () => {
    getGames.mockResolvedValue(result([]))
    renderGames()

    expect(await screen.findByRole('heading', { name: '当前还没有开放的游戏目录' })).toBeInTheDocument()
    expect(screen.getByText('地图、英雄和点位由管理员统一维护。')).toBeInTheDocument()
    expect(screen.getByText('普通用户不能创建正式游戏。')).toBeInTheDocument()
  })

  it('redirects one unfiltered game directly to its map directory', async () => {
    getGames.mockResolvedValue(result([game(1, { slug: 'overwatch' })]))
    renderGames()

    expect(await screen.findByText('已进入地图目录')).toBeInTheDocument()
  })

  it('keeps a single game visible when an explicit sort context exists', async () => {
    getGames.mockResolvedValue(result([game(1)]))
    renderGames('/games?sort=latest')

    expect(await screen.findByRole('link', { name: '进入地图目录' })).toHaveAttribute('href', '/game/game-1/maps')
    expect(screen.queryByText('已进入地图目录')).not.toBeInTheDocument()
  })

  it('renders responsive two-column cards with all key directory facts', async () => {
    getGames.mockResolvedValue(result([game(1), game(2)]))
    const { container } = renderGames()

    expect(await screen.findByRole('heading', { name: '游戏1' })).toBeInTheDocument()
    expect(container.querySelector('.games-directory-grid')).toBeInTheDocument()
    expect(screen.getByText('Game 1')).toBeInTheDocument()
    expect(screen.getByText('v1')).toBeInTheDocument()
    const firstStats = screen.getAllByLabelText('目录统计')[0]
    expect(firstStats).toHaveTextContent('2 张地图')
    expect(firstStats).toHaveTextContent('3 位英雄')
    expect(firstStats).toHaveTextContent('3 个点位')
    expect(screen.getAllByRole('img', { name: /暂无图片/ }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: '进入地图目录' })[0]).toHaveAttribute('href', '/game/game-1/maps')
  })

  it('writes search to the URL-driven request and restores it on reload', async () => {
    const user = userEvent.setup()
    getGames.mockResolvedValue(result([game(1), game(2)]))
    renderGames('/games?query=守望&sort=latest&page=2')

    await waitFor(() => expect(getGames).toHaveBeenCalledWith({
      query: '守望',
      sort: 'latest',
      page: 2,
      page_size: 12,
    }))
    expect(screen.getByLabelText('搜索游戏')).toHaveValue('守望')

    await user.clear(screen.getByLabelText('搜索游戏'))
    await user.type(screen.getByLabelText('搜索游戏'), 'OW')

    await waitFor(() => expect(getGames).toHaveBeenLastCalledWith({
      query: 'OW',
      sort: 'latest',
      page: 1,
      page_size: 12,
    }), { timeout: 1500 })
  })

  it('shows an API error and can retry the directory request', async () => {
    const user = userEvent.setup()
    getGames
      .mockRejectedValueOnce(new Error('目录服务暂时不可用。'))
      .mockResolvedValueOnce(result([game(1), game(2)]))
    renderGames()

    expect(await screen.findByRole('alert')).toHaveTextContent('目录服务暂时不可用。')
    await user.click(screen.getByRole('button', { name: '重新加载' }))

    expect(await screen.findByRole('heading', { name: '游戏1' })).toBeInTheDocument()
    expect(getGames).toHaveBeenCalledTimes(2)
  })
})
