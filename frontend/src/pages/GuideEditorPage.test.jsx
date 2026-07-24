import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createDraft } from '../api/drafts.js'
import { getGameMapHeroes, getGameMaps, getGames } from '../api/games.js'
import { createGuide, getGuide, updateGuide } from '../api/guides.js'
import { uploadImage } from '../api/uploads.js'
import { useAuth } from '../auth/useAuth.js'
import GuideEditorPage from './GuideEditorPage.jsx'


vi.mock('../api/drafts.js', () => ({
  createDraft: vi.fn(),
  getDraft: vi.fn(),
  updateDraft: vi.fn(),
}))

vi.mock('../api/games.js', () => ({
  getGames: vi.fn(),
  getGameMaps: vi.fn(),
  getGameMapHeroes: vi.fn(),
}))

vi.mock('../api/guides.js', () => ({
  createGuide: vi.fn(),
  getGuide: vi.fn(),
  updateGuide: vi.fn(),
}))

vi.mock('../api/uploads.js', () => ({
  uploadImage: vi.fn(),
  deleteUnboundImage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../auth/useAuth.js', () => ({
  useAuth: vi.fn(),
}))


const games = [
  { id: 1, slug: 'overwatch', name_zh: '守望先锋', status: 'active', is_available: true },
  { id: 2, slug: 'valorant', name_zh: '无畏契约', status: 'active', is_available: true },
]
const maps = [
  { id: 11, slug: 'kings-row', name_zh: '国王大道', current_status: 'active', is_available: true, game: games[0] },
  { id: 12, slug: 'gibraltar', name_zh: '监测站：直布罗陀', current_status: 'active', is_available: true, game: games[0] },
]
const heroes = [
  { id: 21, slug: 'ana', name_zh: '安娜', role: 'support', guide_count: 3, is_available: true, game: games[0] },
  { id: 22, slug: 'winston', name_zh: '温斯顿', role: 'tank', guide_count: 0, is_available: true, game: games[0] },
]

function result(data) {
  return { data, meta: { pagination: { total: data.length } } }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function renderEditor(entry = '/guide/create', edit = false) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/guide/create" element={<GuideEditorPage />} />
        <Route path="/guide/:id/edit" element={<GuideEditorPage edit={edit} />} />
        <Route path="/guide/:id" element={<p>已进入点位详情</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function fillPublishFields(user) {
  await user.type(screen.getByLabelText('点位标题'), '睡眠针点位')
  await user.type(screen.getByLabelText('详细说明'), '站在转角对准招牌投掷。')
  await user.type(screen.getByLabelText('外部视频链接'), 'https://example.test/guide')
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuth.mockReturnValue({ user: { role: 'user' } })
  getGames.mockResolvedValue(result([games[0]]))
  getGameMaps.mockResolvedValue(result(maps))
  getGameMapHeroes.mockResolvedValue(result(heroes))
  createGuide.mockResolvedValue({ id: 99 })
  createDraft.mockResolvedValue({ id: 88 })
})


describe('GuideEditorPage cascading point editor', () => {
  it('shows a complete no-game state and an admin management entry', async () => {
    useAuth.mockReturnValue({ user: { role: 'content_admin' } })
    getGames.mockResolvedValue(result([]))
    renderEditor()

    expect(await screen.findByRole('heading', { name: '当前没有可用于发布点位的游戏' })).toBeInTheDocument()
    expect(screen.getByText('游戏、地图和英雄由管理员统一维护。普通用户不能创建正式目录。')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '前往游戏目录管理' })).toHaveAttribute('href', '/admin/catalog')
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  })

  it('automatically selects the only active game and loads its maps', async () => {
    renderEditor()

    await waitFor(() => expect(getGameMaps).toHaveBeenCalledWith('overwatch', { page_size: 100 }, expect.any(AbortSignal)))
    expect(screen.getByLabelText('游戏')).toHaveValue('1')
    expect(screen.getByLabelText('地图')).toBeEnabled()
    expect(screen.getByLabelText('英雄')).toBeDisabled()
  })

  it('clears dependent selections and ignores a stale map response after switching games', async () => {
    const user = userEvent.setup()
    const first = deferred()
    const second = deferred()
    getGames.mockResolvedValue(result(games))
    getGameMaps.mockImplementation((slug) => slug === 'overwatch' ? first.promise : second.promise)
    renderEditor()

    await screen.findByRole('option', { name: '守望先锋' })
    await user.selectOptions(screen.getByLabelText('游戏'), '1')
    await waitFor(() => expect(getGameMaps).toHaveBeenCalledWith('overwatch', { page_size: 100 }, expect.any(AbortSignal)))
    await user.selectOptions(screen.getByLabelText('游戏'), '2')
    expect(screen.getByLabelText('地图')).toHaveValue('')
    expect(screen.getByLabelText('英雄')).toHaveValue('')

    second.resolve(result([{ id: 31, slug: 'ascent', name_zh: '亚海悬城', current_status: 'active', is_available: true, game: games[1] }]))
    expect(await screen.findByRole('option', { name: '亚海悬城' })).toBeInTheDocument()
    first.resolve(result(maps))

    await waitFor(() => expect(screen.queryByRole('option', { name: '国王大道' })).not.toBeInTheDocument())
  })

  it('clears the hero and ignores a stale hero response after switching maps', async () => {
    const user = userEvent.setup()
    const first = deferred()
    const second = deferred()
    getGameMapHeroes.mockImplementation((_game, mapSlug) => mapSlug === 'kings-row' ? first.promise : second.promise)
    renderEditor()

    await screen.findByRole('option', { name: '国王大道' })
    await user.selectOptions(screen.getByLabelText('地图'), '11')
    await waitFor(() => expect(getGameMapHeroes).toHaveBeenCalled())
    await user.selectOptions(screen.getByLabelText('地图'), '12')
    expect(screen.getByLabelText('英雄')).toHaveValue('')

    second.resolve(result([{ id: 41, slug: 'widowmaker', name_zh: '黑百合', guide_count: 1, is_available: true, game: games[0] }]))
    expect(await screen.findByRole('option', { name: '黑百合（当前地图 1 个点位）' })).toBeInTheDocument()
    first.resolve(result(heroes))

    await waitFor(() => expect(screen.queryByRole('option', { name: /安娜/ })).not.toBeInTheDocument())
  })

  it('restores game, map, and hero context from the URL', async () => {
    renderEditor('/guide/create?game=overwatch&map=kings-row&hero=ana')

    await waitFor(() => expect(screen.getByLabelText('当前点位上下文')).toHaveTextContent('守望先锋 / 国王大道 / 安娜'))
    expect(screen.getByLabelText('游戏')).toHaveValue('1')
    expect(screen.getByLabelText('地图')).toHaveValue('11')
    expect(screen.getByLabelText('英雄')).toHaveValue('21')
    expect(getGameMapHeroes).toHaveBeenCalledWith('overwatch', 'kings-row', { page_size: 100 }, expect.any(AbortSignal))
  })

  it('maps timed throw and visualization validation to their nearby fields', async () => {
    const user = userEvent.setup()
    renderEditor('/guide/create?game=overwatch&map=kings-row&hero=ana')
    await screen.findByLabelText('当前点位上下文')
    await user.type(screen.getByLabelText('点位标题'), '定时投掷')
    await user.type(screen.getByLabelText('详细说明'), '开门后投掷。')
    await user.selectOptions(screen.getByLabelText('点位分类'), 'timed_throw')
    await user.click(screen.getByRole('button', { name: '发布点位' }))

    expect(screen.getByText('开局定时投掷必须填写投掷时间或时机。')).toBeInTheDocument()
    expect(screen.getByText('请至少上传一张图片或填写合法外部视频链接。')).toBeInTheDocument()
    expect(createGuide).not.toHaveBeenCalled()
  })

  it('saves an incomplete draft without requiring catalog or publish fields', async () => {
    const user = userEvent.setup()
    getGames.mockResolvedValue(result(games))
    renderEditor()

    await screen.findByRole('option', { name: '守望先锋' })
    await user.type(screen.getByLabelText('点位标题'), '未完成草稿')
    await user.click(screen.getByRole('button', { name: '保存草稿' }))

    await waitFor(() => expect(createDraft).toHaveBeenCalledWith(expect.objectContaining({
      draft_type: 'game_guide',
      payload: expect.objectContaining({ game_id: null, map_id: null, hero_id: null, title: '未完成草稿' }),
    })))
    expect(await screen.findByRole('status')).toHaveTextContent('草稿已保存')
  })

  it('publishes successfully and navigates to the new point detail', async () => {
    const user = userEvent.setup()
    renderEditor('/guide/create?game=overwatch&map=kings-row&hero=ana')
    await screen.findByLabelText('当前点位上下文')
    await fillPublishFields(user)
    await user.click(screen.getByRole('button', { name: '发布点位' }))

    await waitFor(() => expect(createGuide).toHaveBeenCalledWith(expect.objectContaining({
      game_id: 1,
      map_id: 11,
      hero_id: 21,
      title: '睡眠针点位',
    })))
    expect(await screen.findByText('已进入点位详情')).toBeInTheDocument()
  })

  it('shows backend field details next to the matching selector', async () => {
    const user = userEvent.setup()
    const apiError = Object.assign(new Error('请求参数不合法。'), {
      details: [{ field: 'map_id', code: 'unavailable', message: '所选地图当前不可用于发布点位。' }],
    })
    createGuide.mockRejectedValue(apiError)
    renderEditor('/guide/create?game=overwatch&map=kings-row&hero=ana')
    await screen.findByLabelText('当前点位上下文')
    await fillPublishFields(user)
    await user.click(screen.getByRole('button', { name: '发布点位' }))

    expect(await screen.findByText('所选地图当前不可用于发布点位。')).toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(2)
  })

  it('keeps historical inactive catalog selections while editing', async () => {
    const user = userEvent.setup()
    const historicalGame = { ...games[0], status: 'inactive', is_available: false }
    const historicalMap = { ...maps[0], is_available: false, current_status: 'retired' }
    const historicalHero = { ...heroes[0], is_available: false, status: 'inactive' }
    getGames.mockResolvedValue(result([]))
    getGuide.mockResolvedValue({
      id: 55,
      game: historicalGame,
      map: historicalMap,
      hero: historicalHero,
      content_mode: 'simple',
      title: '历史点位',
      category: 'skill_throw',
      instructions: '历史说明',
      timing: null,
      video_url: 'https://example.test/old',
      tags: [],
      steps: [],
    })
    updateGuide.mockResolvedValue({ id: 55 })
    renderEditor('/guide/55/edit', true)

    expect(await screen.findByText('原目录当前不可用于新发布，但历史点位可以保留原关联并继续编辑内容。')).toBeInTheDocument()
    expect(screen.getByLabelText('游戏')).toHaveValue('1')
    expect(screen.getByLabelText('地图')).toHaveValue('11')
    expect(screen.getByLabelText('英雄')).toHaveValue('21')
    expect(screen.getByRole('option', { name: '国王大道（历史关联，当前不可用）' })).toBeInTheDocument()

    await user.clear(screen.getByLabelText('点位标题'))
    await user.type(screen.getByLabelText('点位标题'), '历史点位已修订')
    await user.click(screen.getByRole('button', { name: '保存修改' }))

    await waitFor(() => expect(updateGuide).toHaveBeenCalledWith('55', expect.objectContaining({
      game_id: 1,
      map_id: 11,
      hero_id: 21,
      title: '历史点位已修订',
    })))
  })

  it('retains entered form values when an image upload fails', async () => {
    const user = userEvent.setup()
    uploadImage.mockRejectedValue(new Error('图片上传失败。'))
    renderEditor()
    await screen.findByRole('option', { name: '国王大道' })
    await user.type(screen.getByLabelText('点位标题'), '不会丢失的标题')
    const file = new File(['image'], 'point.webp', { type: 'image/webp' })
    await user.upload(screen.getByLabelText('上传点位图片'), file)

    expect(await screen.findByText('图片上传失败。')).toBeInTheDocument()
    expect(screen.getByLabelText('点位标题')).toHaveValue('不会丢失的标题')
  })
})
