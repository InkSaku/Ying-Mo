import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getGame, getGameHero, getGameMap, getGameMapHeroes, getGameMaps } from '../api/games.js'
import { getGuides } from '../api/guides.js'
import { GameMapDetailPage, GameMapsPage, GamePointListPage } from './GameCatalogPages.jsx'


vi.mock('../api/games.js', () => ({
  getGame: vi.fn(),
  getGameHero: vi.fn(),
  getGameHeroes: vi.fn(),
  getGameMap: vi.fn(),
  getGameMapHeroes: vi.fn(),
  getGameMaps: vi.fn(),
}))

vi.mock('../api/guides.js', () => ({
  getGuides: vi.fn(),
}))


const game = {
  id: 1,
  slug: 'overwatch',
  name_zh: '守望先锋',
  description: '按地图快速查找实用点位。',
  usable_map_count: 2,
  guide_count: 7,
}

function map(overrides = {}) {
  return {
    id: 11,
    slug: 'kings-row',
    name_zh: '国王大道',
    name_en: "King's Row",
    description: '经典混合地图。',
    map_type: 'hybrid',
    current_status: 'active',
    cover_url: null,
    guide_count: 4,
    hero_with_guides_count: 2,
    game,
    ...overrides,
  }
}

function hero(overrides = {}) {
  return {
    id: 21,
    slug: 'ana',
    name_zh: '安娜',
    name_en: 'Ana',
    role: 'support',
    guide_count: 3,
    has_guides: true,
    game,
    ...overrides,
  }
}

function result(data) {
  return { data, meta: { pagination: { page: 1, page_size: 100, total: data.length, total_pages: 1 } } }
}

function renderRoute(entry, path, element) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path={path} element={element} />
      </Routes>
    </MemoryRouter>,
  )
}


beforeEach(() => {
  vi.clearAllMocks()
})


describe('map-first public browsing', () => {
  it('renders active and rotated maps with context, counts, and direct map links', async () => {
    getGame.mockResolvedValue(game)
    getGameMaps.mockResolvedValue(result([
      map(),
      map({ id: 12, slug: 'gibraltar', name_zh: '监测站：直布罗陀', current_status: 'rotated_out', guide_count: 0, hero_with_guides_count: 0 }),
    ]))

    const { container } = renderRoute('/game/overwatch/maps', '/game/:gameSlug/maps', <GameMapsPage />)

    expect(await screen.findByRole('heading', { name: '选择当前地图' })).toBeInTheDocument()
    expect(screen.getByText('守望先锋 · 地图优先')).toBeInTheDocument()
    expect(screen.getByText('2 张可用地图')).toBeInTheDocument()
    expect(screen.getByText('7 个公开点位')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /国王大道/ })).toHaveAttribute('href', '/game/overwatch/map/kings-row')
    expect(screen.getByText(/hybrid · 暂时轮换外/)).toBeInTheDocument()
    expect(screen.getByText('4 个点位')).toBeInTheDocument()
    expect(container.querySelector('.catalog-grid--maps')).toBeInTheDocument()
  })

  it('shows map facts and links every hero directly into the current map combination', async () => {
    getGameMap.mockResolvedValue(map())
    getGameMapHeroes.mockResolvedValue(result([
      hero(),
      hero({ id: 22, slug: 'winston', name_zh: '温斯顿', role: 'tank', guide_count: 0, has_guides: false }),
    ]))

    renderRoute('/game/overwatch/map/kings-row', '/game/:gameSlug/map/:mapSlug', <GameMapDetailPage />)

    expect(await screen.findByRole('heading', { name: '国王大道' })).toBeInTheDocument()
    expect(screen.getByText("King's Row")).toBeInTheDocument()
    expect(screen.getByText(/守望先锋 · hybrid/)).toBeInTheDocument()
    expect(screen.getByText('当前可用')).toBeInTheDocument()
    expect(screen.getByText('4 个点位')).toBeInTheDocument()
    expect(screen.getByText('2 位英雄已有点位')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /安娜/ })).toHaveAttribute('href', '/game/overwatch/map/kings-row/hero/ana')
    expect(screen.getByRole('link', { name: /温斯顿/ })).toHaveAttribute('href', '/game/overwatch/map/kings-row/hero/winston')
    expect(screen.getByRole('link', { name: '发布该地图点位' })).toHaveAttribute('href', '/guide/create?game=overwatch&map=kings-row')
  })

  it('restores hero filters from the URL and writes changes back to requests', async () => {
    const user = userEvent.setup()
    getGameMap.mockResolvedValue(map())
    getGameMapHeroes.mockResolvedValue(result([hero()]))

    renderRoute(
      '/game/overwatch/map/kings-row?query=安娜&role=support&with_guides=true',
      '/game/:gameSlug/map/:mapSlug',
      <GameMapDetailPage />,
    )

    await waitFor(() => expect(getGameMapHeroes).toHaveBeenCalledWith('overwatch', 'kings-row', {
      page_size: 100,
      query: '安娜',
      role: 'support',
      with_guides: 'true',
    }))
    expect(screen.getByLabelText('搜索英雄')).toHaveValue('安娜')
    expect(screen.getByLabelText('英雄定位')).toHaveValue('support')
    expect(screen.getByRole('checkbox', { name: '只看已有点位英雄' })).toBeChecked()

    await user.clear(screen.getByLabelText('搜索英雄'))
    await user.type(screen.getByLabelText('搜索英雄'), '黑百合')
    await user.click(screen.getByRole('button', { name: '搜索' }))

    await waitFor(() => expect(getGameMapHeroes).toHaveBeenLastCalledWith('overwatch', 'kings-row', {
      page_size: 100,
      query: '黑百合',
      role: 'support',
      with_guides: 'true',
    }))
  })

  it('distinguishes an inactive game from a missing map', async () => {
    const inactive = Object.assign(new Error('游戏尚未启用。'), { code: 'GAME_INACTIVE' })
    getGame.mockRejectedValue(inactive)
    getGameMaps.mockRejectedValue(inactive)
    const first = renderRoute('/game/overwatch/maps', '/game/:gameSlug/maps', <GameMapsPage />)

    expect(await screen.findByRole('heading', { name: '这款游戏目录尚未启用' })).toBeInTheDocument()
    first.unmount()

    const missing = Object.assign(new Error('地图不存在。'), { code: 'RESOURCE_NOT_FOUND' })
    getGameMap.mockRejectedValue(missing)
    getGameMapHeroes.mockRejectedValue(missing)
    renderRoute('/game/overwatch/map/missing', '/game/:gameSlug/map/:mapSlug', <GameMapDetailPage />)

    expect(await screen.findByRole('heading', { name: '没有找到地图' })).toBeInTheDocument()
  })

  it('keeps retired maps readable but removes the new-post action', async () => {
    getGameMap.mockResolvedValue(map({ current_status: 'retired' }))
    getGameMapHeroes.mockResolvedValue(result([hero()]))

    renderRoute('/game/overwatch/map/kings-row', '/game/:gameSlug/map/:mapSlug', <GameMapDetailPage />)

    expect(await screen.findByText('已退役')).toBeInTheDocument()
    expect(screen.getByText('这张地图已退役。历史点位仍可查看，但不能用于新建点位。')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '发布该地图点位' })).not.toBeInTheDocument()
  })

  it('shows distinct empty states for no heroes and no points on a map', async () => {
    getGameMap.mockResolvedValue(map({ guide_count: 0, hero_with_guides_count: 0 }))
    getGameMapHeroes.mockResolvedValue(result([]))

    renderRoute('/game/overwatch/map/kings-row', '/game/:gameSlug/map/:mapSlug', <GameMapDetailPage />)

    expect(await screen.findByText('这张地图暂无点位。选择英雄后，可以发布第一个实用点位。')).toBeInTheDocument()
    expect(screen.getByText('这款游戏还没有可用英雄。')).toBeInTheDocument()
  })

  it('retains map and hero context when a combination has no guides', async () => {
    getGameMap.mockResolvedValue(map())
    getGameHero.mockResolvedValue(hero())
    getGuides.mockResolvedValue(result([]))

    renderRoute(
      '/game/overwatch/map/kings-row/hero/ana',
      '/game/:gameSlug/map/:mapSlug/hero/:heroSlug',
      <GamePointListPage />,
    )

    expect(await screen.findByRole('heading', { name: '国王大道 · 安娜' })).toBeInTheDocument()
    expect(screen.getByText('这个英雄在这张地图还没有点位，记录第一个实用位置吧。')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '返回地图英雄选择' })).toHaveAttribute('href', '/game/overwatch/map/kings-row')
    const publish = screen.getByRole('link', { name: '发布当前组合点位' })
    expect(publish).toHaveAttribute('href', '/guide/create?game=overwatch&map=kings-row&hero=ana')
    expect(within(publish).queryByText('选择英雄')).not.toBeInTheDocument()
  })

  it('restores combination filters from the URL and renders complete point card facts', async () => {
    getGameMap.mockResolvedValue(map())
    getGameHero.mockResolvedValue(hero())
    getGuides.mockResolvedValue(result([{
      id: 90,
      title: '拐角睡眠针',
      category: 'skill_throw',
      validity_status: 'valid',
      map: map(),
      hero: hero(),
      map_area: 'A 区',
      side: 'attack',
      timing: '开门后 2 秒',
      excerpt: '站在拐角处瞄准招牌。',
      author: { nickname: '墨友' },
      like_count: 8,
      favorite_count: 5,
      cover_image: null,
      updated_at: '2026-07-20T08:00:00Z',
    }]))

    renderRoute(
      '/game/overwatch/map/kings-row/hero/ana?query=睡眠&category=skill_throw&side=attack&map_area=A+区&validity_status=valid&sort=popular',
      '/game/:gameSlug/map/:mapSlug/hero/:heroSlug',
      <GamePointListPage />,
    )

    await waitFor(() => expect(getGuides).toHaveBeenCalledWith({
      game_slug: 'overwatch',
      map_slug: 'kings-row',
      hero_slug: 'ana',
      query: '睡眠',
      category: 'skill_throw',
      side: 'attack',
      map_area: 'A 区',
      validity_status: 'valid',
      sort: 'popular',
      page: 1,
      page_size: 12,
    }))
    expect(screen.getByLabelText('搜索当前组合点位')).toHaveValue('睡眠')
    expect(screen.getByLabelText('点位分类筛选')).toHaveValue('skill_throw')
    expect(screen.getByLabelText('攻防方筛选')).toHaveValue('attack')
    expect(screen.getByLabelText('地图区域筛选')).toHaveValue('A 区')
    expect(screen.getByLabelText('有效状态筛选')).toHaveValue('valid')
    expect(screen.getByLabelText('点位排序')).toHaveValue('popular')
    const card = (await screen.findByRole('heading', { name: '拐角睡眠针' })).closest('article')
    expect(within(card).getByText('A 区')).toBeInTheDocument()
    expect(within(card).getByText('进攻方')).toBeInTheDocument()
    expect(within(card).getByText('时机：开门后 2 秒')).toBeInTheDocument()
    expect(within(card).getByText('赞 8 · 收藏 5')).toBeInTheDocument()
    expect(screen.queryByLabelText('游戏')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('地图')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('英雄')).not.toBeInTheDocument()
  })
})
