import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { deleteLifePost, getLifePost } from '../api/life.js'
import LifePostDetailPage from './LifePostDetailPage.jsx'

vi.mock('../api/life.js', () => ({
  deleteLifePost: vi.fn(),
  getLifePost: vi.fn(),
}))

vi.mock('../components/interactions/InteractionPanel.jsx', () => ({
  default: () => <div>互动区域</div>,
}))

vi.mock('../components/reports/ReportButton.jsx', () => ({
  default: () => <button type="button">举报</button>,
}))

const basePost = {
  id: 7,
  title: null,
  body: '第一行\n第二行',
  content_format: 'plain',
  external_video_url: null,
  cover_media_id: null,
  cover_media: null,
  images: [],
  tags: [],
  visibility: 'public',
  author: { username: 'writer', nickname: '记录者' },
  chapter: { name: '个人日记', slug: 'diary' },
  created_at: '2026-07-27T08:00:00Z',
  can_edit: false,
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/life/post/7']}>
      <Routes>
        <Route path="/life/post/:id" element={<LifePostDetailPage />} />
        <Route path="/life" element={<p>返回生活区</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  deleteLifePost.mockResolvedValue(undefined)
})

describe('life post detail body formats', () => {
  it('shows plain text line breaks without an empty title heading', async () => {
    getLifePost.mockResolvedValue(basePost)
    const { container } = renderDetail()

    expect(await screen.findByText(/第一行/)).toHaveClass('life-detail__body--plain')
    expect(container.querySelector('.life-detail__heading h1')).not.toBeInTheDocument()
  })

  it('renders Markdown and a controlled external video link', async () => {
    getLifePost.mockResolvedValue({
      ...basePost,
      title: 'Markdown 日记',
      body: '## 小标题\n\n**重要内容**',
      content_format: 'markdown',
      external_video_url: 'https://www.bilibili.com/video/example',
    })
    renderDetail()

    expect(await screen.findByRole('heading', { name: '小标题' })).toBeInTheDocument()
    expect(screen.getByText('重要内容').tagName).toBe('STRONG')
    expect(screen.getByRole('link', { name: '打开视频' })).toHaveAttribute(
      'href',
      'https://www.bilibili.com/video/example',
    )
  })

  it('renders an explicit top cover and inline body media without duplicating the gallery', async () => {
    const inlineMedia = {
      id: 11,
      public_id: '12345678-1234-1234-1234-123456789abc',
      media_type: 'image',
      url: 'https://example.test/inline.webp',
      thumbnail_url: 'https://example.test/inline-thumb.webp',
      width: 1200,
      height: 800,
    }
    const coverMedia = {
      id: 12,
      public_id: '87654321-4321-4321-4321-cba987654321',
      media_type: 'image',
      url: 'https://example.test/cover.webp',
      thumbnail_url: 'https://example.test/cover-thumb.webp',
      width: 1600,
      height: 900,
    }
    getLifePost.mockResolvedValue({
      ...basePost,
      title: '图文交叉',
      body: `图片前\n\n{{yingmo-media:${inlineMedia.public_id}}}\n\n图片后`,
      content_format: 'markdown',
      cover_media_id: coverMedia.id,
      cover_media: coverMedia,
      images: [inlineMedia, coverMedia],
    })
    const { container } = renderDetail()

    expect(await screen.findByRole('img', { name: '图文交叉的封面' })).toHaveAttribute(
      'src',
      coverMedia.url,
    )
    expect(screen.getByRole('img', { name: /图文交叉，第/ })).toHaveAttribute(
      'src',
      inlineMedia.url,
    )
    expect(screen.getByText('图片前')).toBeInTheDocument()
    expect(screen.getByText('图片后')).toBeInTheDocument()
    expect(container.querySelector('.life-gallery')).toBeInTheDocument()
    expect(container.querySelector('.life-gallery__flow')).not.toBeInTheDocument()
  })

  it('uses the styled confirmation dialog and restores focus when cancelled', async () => {
    const user = userEvent.setup()
    getLifePost.mockResolvedValue({
      ...basePost,
      title: '夏日散步',
      can_edit: true,
    })
    renderDetail()

    const deleteButton = await screen.findByRole('button', { name: '删除内容' })
    await user.click(deleteButton)

    const dialog = screen.getByRole('dialog', { name: '要和这篇记录告别吗？' })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveTextContent('夏日散步')
    await waitFor(() => expect(screen.getByRole('button', { name: '先保留' })).toHaveFocus())
    expect(deleteLifePost).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(deleteButton).toHaveFocus())
  })

  it('deletes only after dialog confirmation and returns to the life page', async () => {
    const user = userEvent.setup()
    getLifePost.mockResolvedValue({
      ...basePost,
      can_edit: true,
    })
    renderDetail()

    await user.click(await screen.findByRole('button', { name: '删除内容' }))
    await user.click(screen.getByRole('button', { name: '确认删除' }))

    await waitFor(() => expect(deleteLifePost).toHaveBeenCalledWith(7))
    expect(await screen.findByText('返回生活区')).toBeInTheDocument()
  })

  it('keeps the dialog open and shows the API error when deletion fails', async () => {
    const user = userEvent.setup()
    deleteLifePost.mockRejectedValueOnce(new Error('暂时无法删除，请稍后重试。'))
    getLifePost.mockResolvedValue({
      ...basePost,
      can_edit: true,
    })
    renderDetail()

    await user.click(await screen.findByRole('button', { name: '删除内容' }))
    await user.click(screen.getByRole('button', { name: '确认删除' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('暂时无法删除，请稍后重试。')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认删除' })).toBeEnabled()
  })
})
