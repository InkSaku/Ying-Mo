import { render, screen, waitFor } from '@testing-library/react'
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

function renderPage() {
  return render(<MemoryRouter><AdminContentPage /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  admin.getAdminLifePosts.mockResolvedValue(empty)
  admin.getAdminGuides.mockResolvedValue({ data: [guide], meta: { pagination: { total: 1 } } })
  admin.getAdminComments.mockResolvedValue(empty)
  admin.getAdminFeatured.mockResolvedValue(empty)
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
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('有效状态（必填）'), 'possibly_invalid')
    await user.type(screen.getByLabelText('操作原因（必填）'), '版本更新后需要复核')
    await user.click(screen.getByRole('button', { name: '确认' }))

    await waitFor(() => expect(admin.updateGuideValidity).toHaveBeenCalledWith(90, {
      validity_status: 'possibly_invalid',
      reason: '版本更新后需要复核',
    }))
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
