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
    aliases: ['国王街', 'KR'],
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

function guide(overrides = {}) {
  return {
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
      map({ id: 13, slug: 'hanamura', name_zh: '花村', current_status: 'retired', guide_count: 2, hero_with_guides_count: 1 }),
    ]))

    const { container } = renderRoute('/game/overwatch/maps', '/game/:gameSlug/maps', <GameMapsPage />)

    expect(await screen.findByRole('heading', { name: '你现在，在哪张地图？' })).toBeInTheDocument()
    expect(screen.getByText('守望先锋 · 从地图出发')).toBeInTheDocument()
    expect(screen.getByText('2 张可用地图')).toBeInTheDocument()
    expect(screen.getByText('7 个公开点位')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /国王大道/ })).toHaveAttribute('href', '/game/overwatch/map/kings-row')
    const rotatedMap = screen.getByRole('link', { name: /监测站：直布罗陀/ })
    expect(within(rotatedMap).getByText('hybrid')).toBeInTheDocument()
    expect(within(rotatedMap).getByText('暂时轮换外')).toBeInTheDocument()
    expect(within(screen.getByRole('link', { name: /花村/ })).getByText('已退役')).toBeInTheDocument()
    expect(screen.getByText('4 个点位')).toBeInTheDocument()
    expect(container.querySelector('.catalog-grid--maps')).toBeInTheDocument()
  })

  it('filters loaded maps by names and aliases, then restores the complete directory when cleared', async () => {
    const user = userEvent.setup()
    getGame.mockResolvedValue(game)
    getGameMaps.mockResolvedValue(result([
      map(),
      map({ id: 12, slug: 'gibraltar', name_zh: '监测站：直布罗陀', name_en: 'Watchpoint: Gibraltar', aliases: ['直布罗陀'] }),
      map({ id: 13, slug: 'lijiang-tower', name_zh: '漓江塔', name_en: 'Lijiang Tower', aliases: ['漓江'] }),
    ]))

    renderRoute('/game/overwatch/maps', '/game/:gameSlug/maps', <GameMapsPage />)

    const search = await screen.findByRole('searchbox', { name: '地图关键词' })
    expect(screen.getAllByRole('link', { name: /个点位/ })).toHaveLength(3)

    await user.type(search, '直布罗陀')
    expect(screen.getByRole('link', { name: /监测站：直布罗陀/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /国王大道/ })).not.toBeInTheDocument()
    expect(screen.getByText('找到 1 张地图')).toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'KR')
    expect(screen.getByRole('link', { name: /国王大道/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /漓江塔/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '清空' }))
    expect(search).toHaveValue('')
    expect(screen.getAllByRole('link', { name: /个点位/ })).toHaveLength(3)
    expect(screen.getByText('共 3 张地图')).toBeInTheDocument()
  })

  it('shows a restrained empty result and can clear the search', async () => {
    const user = userEvent.setup()
    getGame.mockResolvedValue(game)
    getGameMaps.mockResolvedValue(result([map()]))

    renderRoute('/game/overwatch/maps', '/game/:gameSlug/maps', <GameMapsPage />)

    const search = await screen.findByRole('searchbox', { name: '地图关键词' })
    await user.type(search, '不存在的地图')

    expect(screen.getByText('没有找到匹配的地图')).toBeInTheDocument()
    expect(screen.getByText('找到 0 张地图')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /国王大道/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '清空搜索' }))
    expect(search).toHaveValue('')
    expect(screen.getByRole('link', { name: /国王大道/ })).toHaveAttribute('href', '/game/overwatch/map/kings-row')
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
    expect(screen.getByRole('link', { name: '为这张地图留个点位' })).toHaveAttribute('href', '/guide/create?game=overwatch&map=kings-row')
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
    expect(screen.queryByRole('link', { name: '为这张地图留个点位' })).not.toBeInTheDocument()
  })

  it('shows distinct empty states for no heroes and no points on a map', async () => {
    getGameMap.mockResolvedValue(map({ guide_count: 0, hero_with_guides_count: 0 }))
    getGameMapHeroes.mockResolvedValue(result([]))

    renderRoute('/game/overwatch/map/kings-row', '/game/:gameSlug/map/:mapSlug', <GameMapDetailPage />)

    expect(await screen.findByText('这张地图还没有路标。选择英雄后，可以留下第一个实用点位。')).toBeInTheDocument()
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
    expect(screen.getByText('这位英雄在这张地图上还没有路标。若你走通过一条路，不妨把它留下。')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '返回地图英雄选择' })).toHaveAttribute('href', '/game/overwatch/map/kings-row')
    const publish = screen.getByRole('link', { name: '在这里留个路标' })
    expect(publish).toHaveAttribute('href', '/guide/create?game=overwatch&map=kings-row&hero=ana')
    expect(within(publish).queryByText('选择英雄')).not.toBeInTheDocument()
  })

  it('shows compact primary filters, result count, sparse results, and the original point target', async () => {
    getGameMap.mockResolvedValue(map())
    getGameHero.mockResolvedValue(hero())
    getGuides.mockResolvedValue(result([guide(), guide({ id: 91, title: '高台睡眠针' })]))

    const { container } = renderRoute(
      '/game/overwatch/map/kings-row/hero/ana',
      '/game/:gameSlug/map/:mapSlug/hero/:heroSlug',
      <GamePointListPage />,
    )

    expect(await screen.findByRole('heading', { name: '国王大道 · 安娜' })).toBeInTheDocument()
    expect(screen.getByText('守望先锋')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: '搜索当前组合点位' })).toBeVisible()
    expect(screen.getByLabelText('点位分类筛选')).toBeVisible()
    expect(screen.getByLabelText('攻防方筛选')).toBeVisible()
    expect(screen.getByText('共 2 个点位')).toBeInTheDocument()
    expect(screen.getByText('已启用 0 项筛选')).toBeInTheDocument()
    expect(container.querySelector('.guide-combination-filters__more')).not.toHaveAttribute('open')
    expect(container.querySelector('.guide-results')).toHaveClass('guide-results--sparse')
    expect(screen.getByRole('link', { name: /拐角睡眠针/ })).toHaveAttribute('href', '/guide/90')
    expect(screen.getByRole('link', { name: /高台睡眠针/ })).toHaveAttribute('href', '/guide/91')
  })

  it('applies keyword and common filters through the existing request, shows no matches, and clears all', async () => {
    const user = userEvent.setup()
    getGameMap.mockResolvedValue(map())
    getGameHero.mockResolvedValue(hero())
    getGuides.mockImplementation(async (filters) => result(filters.query === '不存在' ? [] : [guide()]))

    renderRoute(
      '/game/overwatch/map/kings-row/hero/ana',
      '/game/:gameSlug/map/:mapSlug/hero/:heroSlug',
      <GamePointListPage />,
    )

    const searchbox = await screen.findByRole('searchbox', { name: '搜索当前组合点位' })
    await user.selectOptions(screen.getByLabelText('点位分类筛选'), 'skill_throw')
    await user.selectOptions(screen.getByLabelText('攻防方筛选'), 'attack')
    await waitFor(() => expect(getGuides).toHaveBeenLastCalledWith(expect.objectContaining({
      category: 'skill_throw',
      side: 'attack',
    })))
    expect(screen.getByText('已启用 2 项筛选')).toBeInTheDocument()

    await user.type(searchbox, '不存在')
    await user.click(screen.getByRole('button', { name: '搜索点位' }))
    await waitFor(() => expect(getGuides).toHaveBeenLastCalledWith(expect.objectContaining({
      query: '不存在',
      category: 'skill_throw',
      side: 'attack',
    })))
    expect(await screen.findByText('没有符合当前筛选条件的点位。清除筛选后再试。')).toBeInTheDocument()
    expect(screen.getByText('0 个匹配结果')).toBeInTheDocument()
    expect(screen.getByText('已启用 3 项筛选')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '清除全部' }))
    await waitFor(() => expect(getGuides).toHaveBeenLastCalledWith(expect.objectContaining({
      query: '',
      category: '',
      side: '',
      map_area: '',
      validity_status: '',
      sort: 'updated',
    })))
    expect(searchbox).toHaveValue('')
    expect(screen.getByLabelText('点位分类筛选')).toHaveValue('')
    expect(screen.getByLabelText('攻防方筛选')).toHaveValue('')
    expect(screen.getByText('共 1 个点位')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '拐角睡眠针' })).toBeInTheDocument()
  })

  it('keeps advanced filter values when the more section is collapsed and counts them accurately', async () => {
    const user = userEvent.setup()
    getGameMap.mockResolvedValue(map())
    getGameHero.mockResolvedValue(hero())
    getGuides.mockResolvedValue(result([guide()]))

    const { container } = renderRoute(
      '/game/overwatch/map/kings-row/hero/ana',
      '/game/:gameSlug/map/:mapSlug/hero/:heroSlug',
      <GamePointListPage />,
    )

    await screen.findByRole('heading', { name: '拐角睡眠针' })
    const more = container.querySelector('.guide-combination-filters__more')
    await user.click(screen.getByText('更多筛选'))
    expect(more).toHaveAttribute('open')

    await user.type(screen.getByLabelText('地图区域筛选'), 'A 区')
    await user.selectOptions(screen.getByLabelText('有效状态筛选'), 'valid')
    await user.selectOptions(screen.getByLabelText('点位排序'), 'popular')
    await waitFor(() => expect(getGuides).toHaveBeenLastCalledWith(expect.objectContaining({
      map_area: 'A 区',
      validity_status: 'valid',
      sort: 'popular',
    })))
    expect(screen.getByText('已启用 3 项筛选')).toBeInTheDocument()
    expect(screen.getByText('3 项已启用')).toBeInTheDocument()

    await user.click(screen.getByText('更多筛选'))
    expect(more).not.toHaveAttribute('open')
    expect(screen.getByLabelText('地图区域筛选')).toHaveValue('A 区')
    expect(screen.getByLabelText('有效状态筛选')).toHaveValue('valid')
    expect(screen.getByLabelText('点位排序')).toHaveValue('popular')
  })

  it('restores combination filters from the URL and renders complete point card facts', async () => {
    getGameMap.mockResolvedValue(map())
    getGameHero.mockResolvedValue(hero())
    getGuides.mockResolvedValue(result([guide()]))

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
