import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getLifeChapter, getLifePosts } from '../api/life.js'
import { useAuth } from '../auth/useAuth.js'
import LifeChapterDetailPage from './LifeChapterDetailPage.jsx'


vi.mock('../api/life.js', () => ({
  getLifeChapter: vi.fn(),
  getLifePosts: vi.fn(),
}))

vi.mock('../auth/useAuth.js', () => ({
  useAuth: vi.fn(),
}))


function renderDetail(slug = 'old-slug') {
  return render(
    <MemoryRouter initialEntries={[`/life/chapter/${slug}`]}>
      <Routes>
        <Route path="/life/chapter/:slug" element={<LifeChapterDetailPage />} />
        <Route path="/canonical-destination" element={<p>目标章节</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuth.mockReturnValue({ user: null })
  getLifePosts.mockResolvedValue({
    data: [],
    meta: { pagination: { page: 1, pages: 0, has_next: false, has_prev: false } },
  })
})


describe('life chapter detail permissions', () => {
  it('replaces a merged slug with its canonical chapter route', async () => {
    getLifeChapter.mockImplementation((slug) => {
      if (slug === 'old-slug') return Promise.resolve({ canonical_slug: 'target-slug' })
      return Promise.resolve({
        id: 2,
        name: '目标章节',
        slug: 'target-slug',
        chapter_type: 'city',
        contribution_policy: 'public',
        creator: { username: 'owner', nickname: '创建者' },
        content_count: 0,
        contributor_count: 0,
        can_post: false,
        can_edit: false,
        can_delete: false,
        children: [],
      })
    })
    renderDetail()

    expect(await screen.findByRole('heading', { name: '目标章节' })).toBeInTheDocument()
    expect(getLifeChapter).toHaveBeenCalledWith('target-slug')
  })

  it('keeps private chapters visible but removes post and management actions for a non-owner', async () => {
    getLifeChapter.mockResolvedValue({
      id: 3,
      name: '私人记录',
      slug: 'private',
      chapter_type: 'travel',
      contribution_policy: 'private',
      creator: { username: 'owner', nickname: '创建者' },
      content_count: 0,
      contributor_count: 0,
      is_owner: false,
      can_post: false,
      can_edit: false,
      can_delete: false,
      children: [],
    })
    renderDetail('private')

    expect(await screen.findByRole('heading', { name: '私人记录' })).toBeInTheDocument()
    expect(screen.getByText('所有人可浏览，仅章节创建者可投稿。')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '发布到此章节' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '编辑章节' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '删除章节' })).not.toBeInTheDocument()
  })

  it('shows posting and ownership controls when the DTO grants them', async () => {
    useAuth.mockReturnValue({ user: { role: 'user' } })
    getLifeChapter.mockResolvedValue({
      id: 5,
      name: '我的公有章节',
      slug: 'mine',
      chapter_type: 'city',
      contribution_policy: 'public',
      creator: { username: 'owner', nickname: '创建者' },
      content_count: 2,
      contributor_count: 1,
      is_owner: true,
      can_post: true,
      can_edit: true,
      can_delete: true,
      children: [],
    })
    renderDetail('mine')

    expect(await screen.findByRole('link', { name: '发布到此章节' })).toHaveAttribute('href', '/life/create?chapter=5')
    expect(screen.getByRole('link', { name: '编辑章节' })).toHaveAttribute('href', '/life/chapters/5/edit')
    expect(screen.getByRole('button', { name: '删除章节' })).toBeInTheDocument()
  })
})
