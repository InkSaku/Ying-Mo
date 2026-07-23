import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getGuide } from '../api/guides.js'
import GuideDetailPage from './GuideDetailPage.jsx'


vi.mock('../api/guides.js', () => ({
  getGuide: vi.fn(),
  deleteGuide: vi.fn(),
  setGuideValidityFeedback: vi.fn(),
}))

vi.mock('../components/interactions/InteractionPanel.jsx', () => ({
  default: () => <section>互动区域</section>,
}))

vi.mock('../components/reports/ReportButton.jsx', () => ({
  default: () => <button type="button">举报</button>,
}))


function guide(overrides = {}) {
  return {
    id: 90,
    title: '国王大道睡眠针',
    author: { nickname: '墨友' },
    game: { id: 1, slug: 'overwatch', name_zh: '守望先锋', is_available: true },
    map: { id: 11, slug: 'kings-row', name_zh: '国王大道', is_available: true },
    hero: { id: 21, slug: 'ana', name_zh: '安娜', is_available: true },
    content_mode: 'steps',
    category: 'timed_throw',
    side: 'attack',
    map_area: 'A 区',
    timing: '开门后 2.5 秒',
    game_version: '15.2',
    validity_status: 'valid',
    instructions: '站在拐角，对准招牌顶端投掷。',
    skill: '睡眠针',
    aim_reference: '红色招牌顶端',
    notes: '注意敌方屏障。',
    video_url: 'https://example.test/video',
    tested_at: '2026-07-18',
    last_confirmed_at: '2026-07-19T08:00:00Z',
    updated_at: '2026-07-20T08:00:00Z',
    tags: ['睡眠针'],
    steps: [{ id: 1, url: '/image.webp', title: '第一步', description: '贴近墙角。' }],
    validity_feedback: { valid: 2, possibly_invalid: 1, current_user: null },
    can_edit: true,
    can_delete: true,
    ...overrides,
  }
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/guide/90']}>
      <Routes>
        <Route path="/guide/:id" element={<GuideDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})


describe('GuideDetailPage', () => {
  it('puts map, hero, validity, timing, version, and confirmation before long-form content', async () => {
    getGuide.mockResolvedValue(guide())
    renderDetail()

    expect(await screen.findByRole('heading', { name: '国王大道睡眠针' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '返回 国王大道 · 安娜 点位列表' })).toHaveAttribute('href', '/game/overwatch/map/kings-row/hero/ana')
    expect(screen.getByText('开局定时投掷')).toBeInTheDocument()
    expect(screen.getByText('进攻方')).toBeInTheDocument()
    expect(screen.getByText('A 区')).toBeInTheDocument()
    expect(screen.getByText('开门后 2.5 秒')).toBeInTheDocument()
    expect(screen.getByText('15.2')).toBeInTheDocument()
    expect(screen.getByText('2026-07-18')).toBeInTheDocument()
    expect(screen.getByText('当前有效')).toBeInTheDocument()
    expect(screen.getByText('站在拐角，对准招牌顶端投掷。')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '分步说明' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '编辑点位' })).toHaveAttribute('href', '/guide/90/edit')
    expect(screen.getByRole('button', { name: '删除点位' })).toBeInTheDocument()
  })

  it('shows historical catalog unavailability and hides author actions for other users', async () => {
    getGuide.mockResolvedValue(guide({
      game: { id: 1, slug: 'overwatch', name_zh: '守望先锋', is_available: false },
      map: { id: 11, slug: 'kings-row', name_zh: '国王大道', is_available: false },
      hero: { id: 21, slug: 'ana', name_zh: '安娜', is_available: false },
      can_edit: false,
      can_delete: false,
    }))
    renderDetail()

    expect(await screen.findByText('关联的游戏、地图或英雄当前不可用于新发布；这个历史点位仍会保留并可继续查看。')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '编辑点位' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '删除点位' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '返回 国王大道 · 安娜 点位列表' })).toBeInTheDocument()
  })
})
