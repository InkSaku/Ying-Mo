import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as admin from '../api/admin.js'
import { AdminLogsPage, AdminReportDetailPage } from './AdminPages.jsx'

vi.mock('../api/admin.js', () => ({
  getAdminReport: vi.fn(),
  getAdminLogs: vi.fn(),
}))

vi.mock('../auth/useAuth.js', () => ({
  useAuth: () => ({ user: { role: 'system_admin' } }),
}))

function renderReport() {
  return render(
    <MemoryRouter initialEntries={['/admin/reports/17']}>
      <Routes>
        <Route path="/admin/reports/:id" element={<AdminReportDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Admin governance detail pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('用中文任务信息和结构化快照展示举报详情', async () => {
    admin.getAdminReport.mockResolvedValue({
      id: 17,
      target_id: 91,
      target_type: 'game_guide',
      reason: 'misinformation',
      status: 'in_progress',
      reporter: { username: 'reporter', nickname: '反馈者' },
      assigned_to: { username: 'admin', nickname: '管理员' },
      description: '地图版本更新后无法复现。',
      created_at: '2026-07-28T06:30:00Z',
      updated_at: '2026-07-29T06:30:00Z',
      target_exists: true,
      target_snapshot: {
        title: '安娜睡针点位',
        status: 'published',
        map_id: 3,
      },
      allowed_actions: ['hide_content', 'mark_guide_invalid'],
    })

    renderReport()

    expect(await screen.findByRole('heading', { name: '举报 #17' })).toBeInTheDocument()
    expect(screen.getByText('错误或误导信息')).toBeInTheDocument()
    expect(screen.getByText('地图版本更新后无法复现。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下架内容' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '标记点位失效' })).toBeInTheDocument()
    expect(screen.queryByText('"title"')).not.toBeInTheDocument()
  })

  it('把日志修改前后数据展示为可读对照区', async () => {
    const interaction = userEvent.setup()
    admin.getAdminLogs.mockResolvedValue({
      data: [{
        id: 8,
        admin: { username: 'admin', nickname: '映墨管理员' },
        admin_role: 'system_admin',
        action: 'content_hidden',
        target_type: 'game_guide',
        target_id: 91,
        target_label: '安娜睡针点位',
        before_data: { status: 'published' },
        after_data: { status: 'hidden' },
        metadata: { reason: '版本失效' },
        created_at: '2026-07-29T06:30:00Z',
      }],
      meta: {},
    })

    render(<MemoryRouter><AdminLogsPage /></MemoryRouter>)
    await interaction.click(await screen.findByRole('button', { name: '查看详情' }))

    const detail = within(screen.getByLabelText('日志 #8 详情'))
    expect(detail.getByRole('heading', { name: '修改前' })).toBeInTheDocument()
    expect(detail.getByRole('heading', { name: '修改后' })).toBeInTheDocument()
    expect(detail.getByText('published')).toBeInTheDocument()
    expect(detail.getByText('hidden')).toBeInTheDocument()
    expect(detail.getByText('版本失效')).toBeInTheDocument()
  })
})
