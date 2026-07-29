import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as admin from '../api/admin.js'
import { AdminContentPage } from './AdminPages.jsx'


vi.mock('../api/admin.js', () => ({
  getAdminLifePosts: vi.fn(),
  getAdminGuides: vi.fn(),
  getAdminComments: vi.fn(),
  getAdminFeatured: vi.fn(),
  featureContent: vi.fn(),
  hideContent: vi.fn(),
  deleteAdminContent: vi.fn(),
  deleteAdminComment: vi.fn(),
  restoreContent: vi.fn(),
  unfeatureContent: vi.fn(),
  hideComment: vi.fn(),
  restoreComment: vi.fn(),
  updateGuideValidity: vi.fn(),
  updateGuideMetadata: vi.fn(),
  bulkMarkGuidesPossiblyInvalid: vi.fn(),
}))

vi.mock('../auth/useAuth.js', () => ({
  useAuth: () => ({ user: { role: 'content_admin' } }),
}))


const empty = { data: [], meta: { pagination: { total: 0 } } }
const guide = {
  id: 90,
  title: '治理点位',
  status: 'published',
  game: { id: 1, name_zh: '守望先锋' },
  map: { id: 11, name_zh: '国王大道' },
  hero: { id: 21, name_zh: '安娜' },
  category: 'skill_throw',
  validity_status: 'valid',
  validity_feedback: { valid: 2, possibly_invalid: 1 },
}

const lifePost = {
  id: 41,
  title: '雨后的社区花园',
  body: '雨停以后，社区花园的石板路泛着微光，适合慢慢散步。',
  status: 'published',
  visibility: 'public',
  location: '社区花园',
  mood: '放松',
  created_at: '2026-07-29T06:30:00Z',
  featured: false,
  author: { username: 'ink_friend', nickname: '墨友' },
  images: [],
}

function renderPage() {
  return render(<MemoryRouter><AdminContentPage /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  admin.getAdminLifePosts.mockResolvedValue(empty)
  admin.getAdminGuides.mockResolvedValue({ data: [guide], meta: { pagination: { total: 1 } } })
  admin.getAdminComments.mockResolvedValue(empty)
  admin.getAdminFeatured.mockResolvedValue(empty)
  admin.featureContent.mockResolvedValue({ featured: true })
  admin.unfeatureContent.mockResolvedValue(undefined)
  admin.hideContent.mockResolvedValue({ ...lifePost, status: 'hidden' })
  admin.deleteAdminContent.mockResolvedValue(undefined)
  admin.updateGuideValidity.mockResolvedValue({ ...guide, validity_status: 'possibly_invalid' })
  admin.bulkMarkGuidesPossiblyInvalid.mockResolvedValue({ updated: 2 })
})


describe('AdminContentPage guide governance', () => {
  it('updates validity with a required reason through the existing guide panel', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: '点位' }))
    expect(await screen.findByText('治理点位')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '有效状态' }))
    const dialog = await screen.findByRole('dialog')
    await user.selectOptions(within(dialog).getByRole('combobox', { name: '有效状态' }), 'possibly_invalid')
    await user.type(within(dialog).getByRole('textbox', { name: '操作原因' }), '版本更新后需要复核')
    await user.click(within(dialog).getByRole('button', { name: '保存变更' }))

    await waitFor(() => expect(admin.updateGuideValidity).toHaveBeenCalledWith(90, {
      validity_status: 'possibly_invalid',
      reason: '版本更新后需要复核',
    }))
  })

  it('点击内容打开完整预览，并在预览中切换精选状态', async () => {
    const user = userEvent.setup()
    admin.getAdminLifePosts.mockResolvedValue({ data: [lifePost], meta: { pagination: { total: 1 } } })
    renderPage()

    await user.click(await screen.findByRole('button', { name: '查看内容：雨后的社区花园' }))
    const dialog = await screen.findByRole('dialog', { name: '雨后的社区花园' })
    expect(within(dialog).getByText(lifePost.body)).toBeInTheDocument()
    expect(within(dialog).getByText('地点：社区花园')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: '加入精选' }))

    await waitFor(() => expect(admin.featureContent).toHaveBeenCalledWith('life_post', 41, {}))
    expect(await screen.findByRole('status')).toHaveTextContent('已加入编辑精选')
    expect(within(dialog).getByRole('button', { name: '取消精选' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('button', { name: '取消精选' })).toHaveLength(2)

    await user.click(within(dialog).getByRole('button', { name: '取消精选' }))
    await waitFor(() => expect(admin.unfeatureContent).toHaveBeenCalledWith('life_post', 41))
    expect(await screen.findByRole('status')).toHaveTextContent('已取消编辑精选')
    expect(within(dialog).getByRole('button', { name: '加入精选' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('后端返回已精选时只显示亮起的取消精选星标', async () => {
    admin.getAdminLifePosts.mockResolvedValue({
      data: [{ ...lifePost, featured: true }],
      meta: { pagination: { total: 1 } },
    })
    renderPage()

    const star = await screen.findByRole('button', { name: '取消精选' })
    expect(star).toHaveAttribute('aria-pressed', 'true')
    expect(star).toHaveClass('is-active')
    expect(screen.queryByRole('button', { name: '加入精选' })).not.toBeInTheDocument()
  })

  it('为下架和永久删除提供对象信息与分级风险提示', async () => {
    const user = userEvent.setup()
    admin.getAdminLifePosts.mockResolvedValue({ data: [lifePost], meta: { pagination: { total: 1 } } })
    renderPage()

    await user.click(await screen.findByRole('button', { name: '下架' }))
    let dialog = await screen.findByRole('dialog', { name: '下架内容' })
    expect(within(dialog).getByText('雨后的社区花园')).toBeInTheDocument()
    expect(within(dialog).getByText(/下架后内容将从公开区域隐藏/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: '取消' }))

    await user.click(screen.getByRole('button', { name: '永久删除' }))
    dialog = await screen.findByRole('dialog', { name: '永久删除内容' })
    expect(within(dialog).getByText('操作不可撤销')).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/输入 DELETE/)).toHaveAttribute('placeholder', 'DELETE')
  })

  it('requires an operator-written reason for scoped bulk marking and shows the result', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: '点位' }))
    await screen.findByText('按目录批量标记可能失效')
    await user.type(screen.getByLabelText('批量操作游戏 ID'), '1')
    await user.type(screen.getByLabelText('批量操作地图 ID'), '11')
    await user.type(screen.getByLabelText('批量操作原因'), '地图轮换后统一复核')
    await user.click(screen.getByRole('button', { name: '批量标记可能失效' }))

    await waitFor(() => expect(admin.bulkMarkGuidesPossiblyInvalid).toHaveBeenCalledWith({
      game_id: 1,
      map_id: 11,
      reason: '地图轮换后统一复核',
      confirmation: 'BULK_POSSIBLY_INVALID',
    }))
    expect(await screen.findByRole('status')).toHaveTextContent('已标记 2 个点位为可能失效。')
  })
})
