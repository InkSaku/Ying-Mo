import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createComment, getComments } from '../../api/comments.js'
import { getInteractionSummary } from '../../api/interactions.js'
import { AuthContext } from '../../auth/context.js'
import InteractionPanel from './InteractionPanel.jsx'

vi.mock('../../api/comments.js', () => ({
  createComment: vi.fn(),
  deleteComment: vi.fn(),
  getCommentReplies: vi.fn(),
  getComments: vi.fn(),
}))

vi.mock('../../api/interactions.js', () => ({
  favoriteTarget: vi.fn(),
  getInteractionSummary: vi.fn(),
  likeTarget: vi.fn(),
  unfavoriteTarget: vi.fn(),
  unlikeTarget: vi.fn(),
}))

vi.mock('../reports/ReportButton.jsx', () => ({
  default: () => <button type="button">举报评论</button>,
}))

const oldComment = {
  id: 1,
  body: '原来的评论',
  author: { nickname: '旧朋友' },
  created_at: '2026-07-29T05:00:00Z',
  can_delete: false,
  is_deleted: false,
  is_reply: false,
  reply_count: 0,
  replies: [],
}

const newComment = {
  ...oldComment,
  id: 2,
  body: '刚刚写下的评论',
  author: { nickname: '记录者' },
}

function renderPanel() {
  const auth = {
    isAuthenticated: true,
    user: { can_comment: true },
  }
  return render(
    <MemoryRouter initialEntries={['/life/post/7']}>
      <AuthContext.Provider value={auth}>
        <InteractionPanel targetType="life_post" targetId={7} animated />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getInteractionSummary.mockResolvedValue({
    like_count: 0,
    comment_count: 1,
    viewer: { liked: false, favorited: false },
  })
  getComments.mockResolvedValue({ data: [oldComment] })
  createComment.mockResolvedValue(newComment)
})

describe('InteractionPanel immersive comments', () => {
  it('shows a loading transition and marks a newly published comment', async () => {
    const user = userEvent.setup()
    const { container } = renderPanel()

    expect(container.querySelector('.comment-list__loading')).toBeInTheDocument()
    expect(await screen.findByText('原来的评论')).toBeInTheDocument()
    expect(screen.queryByText('还没有评论，来写第一条吧。')).not.toBeInTheDocument()

    getComments.mockResolvedValueOnce({ data: [oldComment, newComment] })
    await user.type(screen.getByPlaceholderText('写下友善、具体的评论…'), newComment.body)
    await user.click(screen.getByRole('button', { name: '发布' }))

    await waitFor(() => expect(createComment).toHaveBeenCalledWith({
      target_type: 'life_post',
      target_id: 7,
      body: newComment.body,
      reply_to_comment_id: null,
    }))
    const fresh = await screen.findByText(newComment.body)
    expect(fresh.closest('.comment')).toHaveClass('comment--fresh')
    expect(fresh.closest('.comment')).toHaveAttribute('data-comment-id', '2')
  })
})
