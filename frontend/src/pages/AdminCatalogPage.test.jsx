import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as admin from '../api/admin.js'
import * as gamesApi from '../api/games.js'
import * as uploadsApi from '../api/uploads.js'
import { AdminCatalogPage, CatalogEditor } from './AdminPages.jsx'


vi.mock('../api/admin.js', () => ({
  getAdminGames: vi.fn(),
  getAdminGame: vi.fn(),
  getAdminGameHeroes: vi.fn(),
  getAdminGameMaps: vi.fn(),
}))

vi.mock('../api/games.js', () => ({
  createGame: vi.fn(),
  updateGame: vi.fn(),
  createGameHero: vi.fn(),
  updateGameHero: vi.fn(),
  createGameMap: vi.fn(),
  updateGameMap: vi.fn(),
}))

vi.mock('../api/uploads.js', () => ({
  uploadImage: vi.fn(),
  deleteUnboundImage: vi.fn(),
  fetchImageBlob: vi.fn(),
}))


function game(overrides = {}) {
  return {
    id: 1,
    name_zh: '守望先锋',
    name_en: 'Overwatch',
    aliases: ['OW'],
    description: '地图优先的点位目录。',
    current_version: '2.15',
    status: 'inactive',
    hero_count: 0,
    map_count: 0,
    active_hero_count: 0,
    usable_map_count: 0,
    guide_count: 0,
    catalog_ready: false,
    catalog_issues: ['请先创建至少一张可用地图。', '请先创建至少一位可用英雄。'],
    icon_url: null,
    icon_thumbnail_url: null,
    cover_url: null,
    cover_thumbnail_url: null,
    ...overrides,
  }
}


function renderCatalog(entry = '/admin/catalog') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/admin/catalog" element={<AdminCatalogPage />} />
      </Routes>
    </MemoryRouter>,
  )
}


beforeEach(() => {
  vi.clearAllMocks()
  admin.getAdminGames.mockResolvedValue({ data: [], meta: {} })
  admin.getAdminGame.mockResolvedValue(null)
  admin.getAdminGameHeroes.mockResolvedValue({ data: [], meta: {} })
  admin.getAdminGameMaps.mockResolvedValue({ data: [], meta: {} })
  uploadsApi.deleteUnboundImage.mockResolvedValue(undefined)
})


describe('AdminCatalogPage', () => {
  it('shows the empty state and opens the new game form', async () => {
    const user = userEvent.setup()
    renderCatalog()

    expect(await screen.findByText('还没有游戏目录。创建第一款游戏后，再为它补充地图和英雄。')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '新建游戏' }))

    expect(screen.getByRole('heading', { name: '新建游戏' })).toBeInTheDocument()
    expect(screen.getByLabelText('中文名')).toBeInTheDocument()
    expect(screen.getByLabelText('简介（可选）')).toBeInTheDocument()
    expect(screen.getByLabelText('当前版本（可选）')).toBeInTheDocument()
  })

  it('submits the game name, description, and version', async () => {
    const user = userEvent.setup()
    gamesApi.createGame.mockResolvedValue(game())
    renderCatalog()

    await screen.findByText('还没有游戏目录。创建第一款游戏后，再为它补充地图和英雄。')
    await user.click(screen.getByRole('button', { name: '新建游戏' }))
    await user.type(screen.getByLabelText('中文名'), '守望先锋')
    await user.type(screen.getByLabelText('简介（可选）'), '用于快速查找地图点位。')
    await user.type(screen.getByLabelText('当前版本（可选）'), '2.15')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(gamesApi.createGame).toHaveBeenCalledWith(expect.objectContaining({
      name_zh: '守望先锋',
      description: '用于快速查找地图点位。',
      current_version: '2.15',
    })))
  })

  it('enters one game workspace and switches hero and map sections', async () => {
    const user = userEvent.setup()
    admin.getAdminGame.mockResolvedValue(game())
    renderCatalog('/admin/catalog?game=1&section=heroes')

    expect(await screen.findByText('当前正在管理：守望先锋')).toBeInTheDocument()
    expect(screen.getByText('这款游戏还没有英雄。添加英雄后，玩家才能发布对应点位。')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '地图' }))

    expect(await screen.findByText('这款游戏还没有地图。添加地图后，玩家才能按地图查找点位。')).toBeInTheDocument()
    expect(admin.getAdminGameMaps).toHaveBeenCalledWith(1, expect.objectContaining({ page_size: 50 }))
  })

  it('shows every backend catalog blocker when activation fails', async () => {
    const user = userEvent.setup()
    const requestError = new Error('请求参数不合法。')
    requestError.details = [
      { field: 'maps', message: '请先创建至少一张可用地图。' },
      { field: 'heroes', message: '请先创建至少一位可用英雄。' },
    ]
    admin.getAdminGames.mockResolvedValue({ data: [game()], meta: {} })
    gamesApi.updateGame.mockRejectedValue(requestError)
    renderCatalog()

    await user.click(await screen.findByRole('button', { name: '启用游戏' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('请先创建至少一张可用地图。')
    expect(screen.getByRole('alert')).toHaveTextContent('请先创建至少一位可用英雄。')
  })

  it('activates a catalog after readiness requirements are met', async () => {
    const user = userEvent.setup()
    const readyGame = game({
      active_hero_count: 1,
      usable_map_count: 1,
      catalog_ready: true,
      catalog_issues: [],
    })
    admin.getAdminGames.mockResolvedValue({ data: [readyGame], meta: {} })
    gamesApi.updateGame.mockResolvedValue({ ...readyGame, status: 'active' })
    renderCatalog()

    await user.click(await screen.findByRole('button', { name: '启用游戏' }))

    await waitFor(() => expect(gamesApi.updateGame).toHaveBeenCalledWith(1, { status: 'active' }))
  })
})


describe('CatalogEditor uploads', () => {
  it('keeps all form content when an image upload fails', async () => {
    const user = userEvent.setup()
    uploadsApi.uploadImage.mockRejectedValue(new Error('图片上传失败，请重试。'))
    const { container } = render(
      <CatalogEditor
        type="game"
        item={null}
        game={null}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    )

    await user.type(screen.getByLabelText('中文名'), '守望先锋')
    await user.type(screen.getByLabelText('简介（可选）'), '不会因为上传失败而丢失。')
    await user.type(screen.getByLabelText('当前版本（可选）'), '2.15')
    const fileInput = container.querySelector('input[type="file"]')
    await user.upload(fileInput, new File(['image'], 'cover.png', { type: 'image/png' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('图片上传失败，请重试。')
    expect(screen.getByLabelText('中文名')).toHaveValue('守望先锋')
    expect(screen.getByLabelText('简介（可选）')).toHaveValue('不会因为上传失败而丢失。')
    expect(screen.getByLabelText('当前版本（可选）')).toHaveValue('2.15')
  })
})
