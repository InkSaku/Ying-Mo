import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { deleteLifePost } from '../api/life.js'
import { getMyLifePosts } from '../api/users.js'
import { MyLifePostsPage } from './MyContentPages.jsx'

vi.mock('../api/guides.js', () => ({
  deleteGuide: vi.fn(),
}))

vi.mock('../api/life.js', () => ({
  deleteLifePost: vi.fn(),
}))

vi.mock('../api/users.js', () => ({
  getMyGuides: vi.fn(),
  getMyLifePosts: vi.fn(),
}))

const lifePost = {
  id: 17,
  title: '窗边的下午',
  excerpt: '阳光落在桌面上。',
  content_format: 'plain',
  has_external_video: false,
  cover_image: null,
  image_count: 0,
  media_count: 0,
  live_video_count: 0,
  like_count: 0,
  comment_count: 0,
  author: { nickname: '记录者' },
  chapter: { name: '个人日记' },
  created_at: '2026-07-27T08:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  getMyLifePosts.mockResolvedValue({
    data: [lifePost],
    meta: { pagination: { page: 1, total_pages: 1 } },
  })
  deleteLifePost.mockResolvedValue(undefined)
})

describe('my life posts deletion', () => {
  it('uses the same custom dialog instead of the browser confirmation', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm')
    render(
      <MemoryRouter>
        <MyLifePostsPage />
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: '删除' }))
    expect(screen.getByRole('dialog', { name: '要和这篇记录告别吗？' })).toHaveTextContent('窗边的下午')
    expect(confirm).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '确认删除' }))
    await waitFor(() => expect(deleteLifePost).toHaveBeenCalledWith(17))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    confirm.mockRestore()
  })
})
