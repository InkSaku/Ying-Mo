import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as adminApi from '../api/admin.js'
import {
  checkLifeChapterName,
  createLifeChapter,
  getLifeChapters,
} from '../api/life.js'
import { getMyChapters } from '../api/users.js'
import { useAuth } from '../auth/useAuth.js'
import LifeChapterCreatePage from './LifeChapterCreatePage.jsx'
import LifeChapterEditPage from './LifeChapterEditPage.jsx'
import MyChaptersPage from './MyChaptersPage.jsx'


vi.mock('../api/admin.js', () => ({
  forceDeleteAdminChapter: vi.fn(),
  getAdminChapter: vi.fn(),
  getAdminChapterDeletionPreview: vi.fn(),
  updateAdminChapter: vi.fn(),
}))

vi.mock('../api/life.js', () => ({
  checkLifeChapterName: vi.fn(),
  createLifeChapter: vi.fn(),
  getLifeChapterDeletionPreview: vi.fn(),
  getLifeChapters: vi.fn(),
  updateLifeChapter: vi.fn(),
}))

vi.mock('../api/users.js', () => ({
  getMyChapter: vi.fn(),
  getMyChapters: vi.fn(),
}))

vi.mock('../api/uploads.js', () => ({
  deleteUnboundImage: vi.fn().mockResolvedValue(undefined),
  fetchImageBlob: vi.fn(),
  uploadImage: vi.fn(),
}))

vi.mock('../auth/useAuth.js', () => ({
  useAuth: vi.fn(),
}))


const baseChapter = {
  id: 7,
  name: '夜航',
  slug: 'night',
  chapter_type: 'travel',
  parent: null,
  country: '中国',
  province: '上海',
  city: '上海',
  description: '完整章节',
  contribution_policy: 'private',
  aliases: ['夜路'],
  review_note: '审核备注',
  review_status: 'approved',
  status: 'active',
  cover_url: 'https://example.test/cover.webp',
  cover_thumbnail_url: 'https://example.test/cover-thumb.webp',
  content_count: 3,
  contributor_count: 2,
  child_count: 0,
  can_delete: true,
  is_owner: false,
  updated_at: '2026-07-25T10:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuth.mockReturnValue({ user: { role: 'system_admin' } })
  checkLifeChapterName.mockResolvedValue({ exact_match: null, candidates: [] })
  getLifeChapters.mockResolvedValue({
    data: [],
    meta: { pagination: { has_next: false } },
  })
  adminApi.getAdminChapterDeletionPreview.mockResolvedValue({
    force_delete_post_count: 3,
    force_delete_child_count: 2,
    force_delete_image_count: 4,
  })
})


describe('chapter creation and editing pages', () => {
  it('submits public explicitly and sends a pending chapter to My Chapters', async () => {
    const user = userEvent.setup()
    createLifeChapter.mockResolvedValue({
      id: 8,
      slug: 'pending-night',
      status: 'active',
      review_status: 'pending',
      contribution_policy: 'public',
    })
    render(
      <MemoryRouter initialEntries={['/life/chapters/create']}>
        <Routes>
          <Route path="/life/chapters/create" element={<LifeChapterCreatePage />} />
          <Route path="/me/chapters" element={<p>已进入我的章节</p>} />
          <Route path="/life/chapter/:slug" element={<p>已进入公开详情</p>} />
        </Routes>
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('名称'), '待审核章节')
    await user.click(screen.getByRole('button', { name: '创建章节' }))

    await waitFor(() => expect(createLifeChapter).toHaveBeenCalledWith(expect.objectContaining({
      name: '待审核章节',
      contribution_policy: 'public',
    })))
    expect(await screen.findByText('已进入我的章节')).toBeInTheDocument()
    expect(screen.queryByText('已进入公开详情')).not.toBeInTheDocument()
  })

  it('opens the public detail when an administrator creates an approved chapter', async () => {
    const user = userEvent.setup()
    createLifeChapter.mockResolvedValue({
      id: 9,
      slug: 'approved-night',
      status: 'active',
      review_status: 'approved',
      contribution_policy: 'public',
    })
    render(
      <MemoryRouter initialEntries={['/life/chapters/create']}>
        <Routes>
          <Route path="/life/chapters/create" element={<LifeChapterCreatePage />} />
          <Route path="/me/chapters" element={<p>已进入我的章节</p>} />
          <Route path="/life/chapter/:slug" element={<p>已进入公开详情</p>} />
        </Routes>
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('名称'), '直接通过章节')
    await user.click(screen.getByRole('button', { name: '创建章节' }))

    expect(await screen.findByText('已进入公开详情')).toBeInTheDocument()
  })

  it('renders the complete admin editor and its separate danger zone', async () => {
    adminApi.getAdminChapter.mockResolvedValue(baseChapter)
    render(
      <MemoryRouter initialEntries={['/admin/chapters/7/edit']}>
        <Routes>
          <Route path="/admin/chapters/:id/edit" element={<LifeChapterEditPage admin />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: '编辑「夜航」' })).toBeInTheDocument()
    for (const label of ['名称', '类型', '父章节（可选）', '国家', '省份', '城市', '简介', '别名（逗号分隔）', '审核备注']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(screen.getByAltText('章节封面预览')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /私有章节/ })).toBeChecked()
    expect(screen.getByRole('heading', { name: '强制永久删除' })).toBeInTheDocument()
    expect(await screen.findByText('当前将永久删除 3 条日常、2 个子章节和 4 张图片。')).toBeInTheDocument()
    expect(screen.getByLabelText('输入 DELETE CHAPTER 7')).toBeInTheDocument()
  })
})


describe('My Chapters', () => {
  it('lists all lifecycle states, policy badges, review notes, and merge targets', async () => {
    getMyChapters.mockResolvedValue({
      data: [
        { ...baseChapter, id: 1, name: '待审', contribution_policy: 'public', review_status: 'pending', status: 'active', review_note: null, is_owner: true },
        { ...baseChapter, id: 2, name: '驳回', review_status: 'rejected', status: 'active', review_note: '请补充说明', is_owner: true },
        { ...baseChapter, id: 3, name: '禁用', review_status: 'approved', status: 'disabled', is_owner: true },
        { ...baseChapter, id: 4, name: '合并', review_status: 'approved', status: 'merged', can_delete: false, merged_into: { name: '归档', slug: 'archive' }, is_owner: true },
      ],
      meta: { pagination: { has_next: false } },
    })
    render(
      <MemoryRouter>
        <MyChaptersPage />
      </MemoryRouter>,
    )

    for (const name of ['待审', '驳回', '禁用', '合并']) {
      expect(await screen.findByRole('heading', { name })).toBeInTheDocument()
    }
    expect(screen.getAllByText('私有章节')).toHaveLength(3)
    expect(screen.getByText('公有章节')).toBeInTheDocument()
    expect(screen.getByText('审核意见：请补充说明')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '归档' })).toHaveAttribute('href', '/life/chapter/archive')
  })
})
