import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createLifePost,
  getLifePost,
  getPostableLifeChapters,
} from '../api/life.js'
import { createDraft, getDraft } from '../api/drafts.js'
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
        <Route path="/life/post/:id/edit" element={<LifePostEditorPage edit />} />
        <Route path="/life/post/:id" element={<p>发布完成</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getPostableLifeChapters.mockResolvedValue(collections)
  createLifePost.mockResolvedValue({ id: 88 })
  createDraft.mockResolvedValue({ id: 77 })
  getDraft.mockResolvedValue({
    id: 77,
    draft_type: 'life_post',
    payload: {
      chapter_id: 11,
      body: null,
      content_format: 'markdown',
      tags: [],
      visibility: 'public',
    },
    media: [],
  })
  getLifePost.mockResolvedValue({
    id: 9,
    title: '已经写下的日常',
    body: '原来的正文',
    content_format: 'markdown',
    chapter: collections.owned[0],
    images: [],
    tags: [],
    visibility: 'public',
  })
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
  it('keeps the primary actions and editor status together', async () => {
    renderEditor('/life/create?chapter_id=11')

    await screen.findByPlaceholderText('写下想留下的内容，支持 Markdown…')
    const actions = screen.getByRole('region', { name: '发布操作' })
    expect(within(actions).getByRole('button', { name: '保存草稿' })).toBeInTheDocument()
    expect(within(actions).getByRole('button', { name: '发布内容' })).toBeInTheDocument()
    expect(within(actions).getByRole('status')).toHaveTextContent('0/9 个媒体')
  })

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

  it('keeps publishing progress visible in the action region', async () => {
    const user = userEvent.setup()
    let finishPublish
    createLifePost.mockReturnValue(new Promise((resolve) => { finishPublish = resolve }))
    renderEditor('/life/create?chapter_id=11')
    const body = await screen.findByPlaceholderText('写下想留下的内容，支持 Markdown…')
    const actions = screen.getByRole('region', { name: '发布操作' })
    await user.type(body, '正在发布的日常。')

    await user.click(within(actions).getByRole('button', { name: '发布内容' }))

    expect(await within(actions).findByText('正在发布内容…')).toBeInTheDocument()
    expect(within(actions).getByRole('button', { name: '保存草稿' })).toBeDisabled()
    expect(within(actions).getByRole('button', { name: '正在发布…' })).toBeDisabled()

    finishPublish({ id: 88 })
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

  it('keeps upload progress visible beside the primary actions', async () => {
    const user = userEvent.setup()
    let finishUpload
    uploadImage.mockReturnValue(new Promise((resolve) => { finishUpload = resolve }))
    const view = renderEditor('/life/create?chapter_id=11')
    await screen.findByPlaceholderText('写下想留下的内容，支持 Markdown…')
    const actions = screen.getByRole('region', { name: '发布操作' })

    await user.click(screen.getByRole('button', { name: '▧ 图片' }))
    const imageInput = view.container.querySelector('input[type="file"][accept*="image/jpeg"]')
    await user.upload(imageInput, new File(['image'], 'uploading.png', { type: 'image/png' }))

    expect(await within(actions).findByText('正在上传 1 个媒体…')).toBeInTheDocument()
    expect(within(actions).getByRole('button', { name: '保存草稿' })).toBeDisabled()
    expect(within(actions).getByRole('button', { name: '发布内容' })).toBeDisabled()

    finishUpload({
      id: 31,
      public_id: '12345678-1234-1234-1234-123456789abc',
      media_type: 'image',
      url: 'https://example.test/inline.webp',
      thumbnail_url: 'https://example.test/inline-thumb.webp',
      width: 1200,
      height: 800,
    })
    await waitFor(() => expect(within(actions).getByRole('status')).toHaveTextContent('1/9 个媒体'))
    expect(within(actions).getByRole('button', { name: '保存草稿' })).toBeEnabled()
    expect(within(actions).getByRole('button', { name: '发布内容' })).toBeEnabled()
  })

  it('shows draft progress and completion without changing draft payload behavior', async () => {
    const user = userEvent.setup()
    let finishDraft
    createDraft.mockReturnValue(new Promise((resolve) => { finishDraft = resolve }))
    renderEditor('/life/create?chapter_id=11')
    await screen.findByPlaceholderText('写下想留下的内容，支持 Markdown…')
    const actions = screen.getByRole('region', { name: '发布操作' })

    await user.click(within(actions).getByRole('button', { name: '保存草稿' }))

    expect(await within(actions).findByText('正在保存草稿…')).toBeInTheDocument()
    expect(createDraft).toHaveBeenCalledWith(expect.objectContaining({
      draft_type: 'life_post',
      media_ids: [],
      payload: expect.objectContaining({ chapter_id: 11 }),
    }))

    finishDraft({ id: 77 })
    await waitFor(() => expect(
      within(screen.getByRole('region', { name: '发布操作' })).getByRole('status'),
    ).toHaveTextContent('草稿已保存。'))
    expect(
      within(screen.getByRole('region', { name: '发布操作' })).getByRole('button', { name: '保存草稿' }),
    ).toBeEnabled()
  })

  it('does not add draft behavior to the existing edit flow', async () => {
    renderEditor('/life/post/9/edit')

    expect(await screen.findByRole('heading', { name: '把这段日常再写一写' })).toBeInTheDocument()
    const actions = screen.getByRole('region', { name: '发布操作' })
    expect(within(actions).queryByRole('button', { name: '保存草稿' })).not.toBeInTheDocument()
    expect(within(actions).getByRole('button', { name: '发布内容' })).toBeInTheDocument()
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
