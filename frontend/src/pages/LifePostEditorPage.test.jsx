import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createLifePost,
  getPostableLifeChapters,
} from '../api/life.js'
import { uploadImage } from '../api/uploads.js'
import LifePostEditorPage from './LifePostEditorPage.jsx'


vi.mock('../api/life.js', () => ({
  createLifePost: vi.fn(),
  getLifePost: vi.fn(),
  getPostableLifeChapters: vi.fn(),
  updateLifePost: vi.fn(),
}))

vi.mock('../api/drafts.js', () => ({
  createDraft: vi.fn(),
  getDraft: vi.fn(),
  updateDraft: vi.fn(),
}))

vi.mock('../api/uploads.js', () => ({
  deleteUnboundMedia: vi.fn().mockResolvedValue(undefined),
  uploadImage: vi.fn(),
  uploadLiveVideo: vi.fn(),
}))

const collections = {
  owned: [{
    id: 11,
    name: '我的日记',
    description: '个人记录',
    content_count: 2,
    is_owner: true,
    can_post: true,
  }],
  contributing: [{
    id: 22,
    name: '朋友们的夏天',
    description: '共同记录',
    content_count: 5,
    is_owner: false,
    can_post: true,
  }],
}

function renderEditor(entry = '/life/create') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/life/create" element={<LifePostEditorPage />} />
        <Route path="/life/post/:id" element={<p>发布完成</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getPostableLifeChapters.mockResolvedValue(collections)
  createLifePost.mockResolvedValue({ id: 88 })
  uploadImage.mockResolvedValue({
    id: 31,
    public_id: '12345678-1234-1234-1234-123456789abc',
    media_type: 'image',
    url: 'https://example.test/inline.webp',
    thumbnail_url: 'https://example.test/inline-thumb.webp',
    width: 1200,
    height: 800,
  })
})

describe('life post create flow', () => {
  it('groups postable collections and enters the fixed-collection editor', async () => {
    const user = userEvent.setup()
    renderEditor()

    expect(await screen.findByRole('heading', { name: '我的合集' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '我可以投稿的合集' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /我的日记/ }))

    expect(await screen.findByText('发布到')).toBeInTheDocument()
    expect(screen.getByText('我的日记')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重新选择' })).toBeInTheDocument()
  })

  it('publishes text without a title or media', async () => {
    const user = userEvent.setup()
    renderEditor('/life/create?chapter_id=11')

    const body = await screen.findByPlaceholderText('写下想留下的内容，支持 Markdown…')
    await user.type(body, '今天完成了项目部署。')
    await user.click(screen.getByRole('button', { name: '发布内容' }))

    await waitFor(() => expect(createLifePost).toHaveBeenCalledWith(expect.objectContaining({
      chapter_id: 11,
      title: null,
      body: '今天完成了项目部署。',
      content_format: 'markdown',
      location: null,
      media_ids: [],
    })))
    expect(await screen.findByText('发布完成')).toBeInTheDocument()
  })

  it('keeps location optional and can confirm a manual value through the picker', async () => {
    const user = userEvent.setup()
    renderEditor('/life/create?chapter_id=11')

    const body = await screen.findByPlaceholderText('写下想留下的内容，支持 Markdown…')
    await user.type(body, '带地点的日记。')
    await user.click(screen.getByRole('button', { name: '⌖ 从地图选择' }))
    await user.type(screen.getByPlaceholderText('例如：回家的路上'), '回家的路上')
    await user.click(screen.getByRole('button', { name: '确定' }))
    await user.click(screen.getByRole('button', { name: '发布内容' }))

    await waitFor(() => expect(createLifePost).toHaveBeenCalledWith(expect.objectContaining({
      body: '带地点的日记。',
      location: '回家的路上',
    })))
  })

  it('uses one Markdown editor without mutually exclusive content modes', async () => {
    const user = userEvent.setup()
    renderEditor('/life/create?chapter_id=11')

    const body = await screen.findByPlaceholderText('写下想留下的内容，支持 Markdown…')
    expect(screen.queryByText('选择记录方式')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /快速记录/ })).not.toBeInTheDocument()
    expect(screen.getByText('正文媒体')).toBeInTheDocument()
    expect(screen.getByText('内容封面')).toBeInTheDocument()
    expect(screen.getByText('外部视频链接')).toBeInTheDocument()
    expect(screen.getByText('更多信息')).toBeInTheDocument()
    await user.type(body, '# 没有清空')
    await user.click(screen.getByRole('button', { name: '预览' }))
    expect(screen.getByRole('heading', { name: '没有清空' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '编辑' }))
    expect(screen.getByDisplayValue('# 没有清空')).toBeInTheDocument()
  })

  it('inserts lightweight Markdown syntax around the current selection', async () => {
    const user = userEvent.setup()
    renderEditor('/life/create?chapter_id=11')

    const body = await screen.findByPlaceholderText('写下想留下的内容，支持 Markdown…')
    expect(screen.getByRole('toolbar', { name: 'Markdown 语法快捷工具' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'H2 标题' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /粗体/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /链接/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /引用/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /代码/ })).toBeInTheDocument()

    await user.type(body, '重点内容')
    body.setSelectionRange(0, 4)
    await user.click(screen.getByRole('button', { name: /粗体/ }))
    await waitFor(() => expect(body).toHaveValue('**重点内容**'))

    await user.click(screen.getByRole('button', { name: '预览' }))
    expect(screen.getByText('重点内容').tagName).toBe('STRONG')
    expect(screen.queryByRole('toolbar', { name: 'Markdown 语法快捷工具' })).not.toBeInTheDocument()
  })

  it('uploads an inline image at the cursor and can reuse it as the explicit cover', async () => {
    const user = userEvent.setup()
    const view = renderEditor('/life/create?chapter_id=11')
    const body = await screen.findByPlaceholderText('写下想留下的内容，支持 Markdown…')
    await user.type(body, '图片之前')
    await user.click(screen.getByRole('button', { name: '▧ 图片' }))

    const imageInput = view.container.querySelector('input[type="file"][accept*="image/jpeg"]')
    await user.upload(imageInput, new File(['image'], 'inline.png', { type: 'image/png' }))

    await waitFor(() => expect(body).toHaveValue(
      '图片之前\n\n{{yingmo-media:12345678-1234-1234-1234-123456789abc|inline}}',
    ))
    const description = await screen.findByLabelText('图片说明 / Alt 文本')
    await user.clear(description)
    await user.type(description, '海边日落')
    await waitFor(() => expect(body).toHaveValue(
      '图片之前\n\n{{yingmo-media:12345678-1234-1234-1234-123456789abc|海边日落}}',
    ))
    await user.click(await screen.findByRole('button', { name: '将第 1 张图片设为封面' }))
    await user.click(screen.getByRole('button', { name: '发布内容' }))

    await waitFor(() => expect(createLifePost).toHaveBeenCalledWith(expect.objectContaining({
      body: '图片之前\n\n{{yingmo-media:12345678-1234-1234-1234-123456789abc|海边日落}}',
      cover_media_id: 31,
      media_ids: [31],
    })))
  })

  it('inserts dropped and pasted images at the current cursor', async () => {
    uploadImage
      .mockReset()
      .mockResolvedValueOnce({
        id: 41,
        public_id: '11111111-1111-4111-8111-111111111111',
        media_type: 'image',
        url: 'https://example.test/dropped.webp',
      })
      .mockResolvedValueOnce({
        id: 42,
        public_id: '22222222-2222-4222-8222-222222222222',
        media_type: 'image',
        url: 'https://example.test/pasted.webp',
      })
    renderEditor('/life/create?chapter_id=11')

    const body = await screen.findByPlaceholderText('写下想留下的内容，支持 Markdown…')
    fireEvent.change(body, { target: { value: '开头结尾' } })
    body.setSelectionRange(2, 2)
    fireEvent.drop(body, {
      dataTransfer: {
        files: [new File(['drop'], '拖入图片.png', { type: 'image/png' })],
        types: ['Files'],
      },
    })

    await waitFor(() => expect(body.value).toContain(
      '开头\n\n{{yingmo-media:11111111-1111-4111-8111-111111111111|拖入图片}}\n\n结尾',
    ))

    body.setSelectionRange(body.value.length, body.value.length)
    fireEvent.paste(body, {
      clipboardData: {
        files: [new File(['paste'], '粘贴图片.webp', { type: 'image/webp' })],
      },
    })

    await waitFor(() => expect(body.value).toContain(
      '{{yingmo-media:22222222-2222-4222-8222-222222222222|粘贴图片}}',
    ))
    expect(uploadImage).toHaveBeenCalledTimes(2)
    expect(screen.getByText('可将图片拖入或粘贴到正文，上传后会插入当前光标位置。')).toBeInTheDocument()
  })
})
