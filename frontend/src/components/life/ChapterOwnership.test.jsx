import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deleteLifeChapter,
  getLifeChapterDeletionPreview,
  getLifeChapters,
} from '../../api/life.js'
import { uploadImage } from '../../api/uploads.js'
import ChapterDeleteDialog from './ChapterDeleteDialog.jsx'
import ChapterEditorForm from './ChapterEditorForm.jsx'
import LifePostForm from './LifePostForm.jsx'


vi.mock('../../api/life.js', () => ({
  checkLifeChapterName: vi.fn().mockResolvedValue({ exact_match: null, candidates: [] }),
  deleteLifeChapter: vi.fn(),
  getLifeChapterDeletionPreview: vi.fn(),
  getLifeChapters: vi.fn(),
}))

vi.mock('../../api/uploads.js', () => ({
  deleteUnboundImage: vi.fn().mockResolvedValue(undefined),
  fetchImageBlob: vi.fn(),
  uploadImage: vi.fn(),
}))

vi.mock('./LifeImageManager.jsx', () => ({
  default: () => <div aria-label="日常图片">已选择图片</div>,
}))


const pagination = { has_next: false }

beforeEach(() => {
  vi.clearAllMocks()
  getLifeChapters.mockResolvedValue({ data: [], meta: { pagination } })
})


describe('chapter editor ownership fields', () => {
  it('defaults to public, explains the distinction, and explicitly submits private', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<ChapterEditorForm onSubmit={onSubmit} />)

    expect(screen.getByRole('radio', { name: /开放投稿/ })).toBeChecked()
    expect(screen.getByText('两种合集都可以被所有人浏览；这里仅控制谁能投稿。')).toBeInTheDocument()
    await user.type(screen.getByLabelText('名称'), '夜航')
    await user.click(screen.getByRole('radio', { name: /仅自己投稿/ }))
    await user.click(screen.getByRole('button', { name: '保存章节' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: '夜航',
      contribution_policy: 'private',
      cover_media_id: null,
    })))
  })

  it('shows an existing cover, replaces it, and can explicitly remove it', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    uploadImage.mockResolvedValue({
      id: 42,
      public_id: 'cover-new',
      thumbnail_url: 'https://example.test/new-cover.webp',
    })
    const { container } = render(
      <ChapterEditorForm
        initial={{
          id: 8,
          name: '旧章节',
          chapter_type: 'city',
          aliases: [],
          contribution_policy: 'public',
          cover_url: 'https://example.test/old-cover.webp',
        }}
        onSubmit={onSubmit}
      />,
    )

    expect(screen.getByAltText('章节封面预览')).toHaveAttribute('src', 'https://example.test/old-cover.webp')
    await user.upload(
      container.querySelector('input[type="file"]'),
      new File(['cover'], 'cover.png', { type: 'image/png' }),
    )
    await waitFor(() => expect(uploadImage).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: '删除章节封面' }))
    await user.click(screen.getByRole('button', { name: '保存章节' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      cover_media_id: null,
    })))
  })

  it('keeps entered fields and reports an upload failure', async () => {
    const user = userEvent.setup()
    uploadImage.mockRejectedValue(new Error('章节封面上传失败'))
    const { container } = render(
      <ChapterEditorForm onSubmit={() => {}} />,
    )

    await user.type(screen.getByLabelText('名称'), '不会丢失')
    await user.upload(
      container.querySelector('input[type="file"]'),
      new File(['cover'], 'cover.png', { type: 'image/png' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('章节封面上传失败')
    expect(screen.getByLabelText('名称')).toHaveValue('不会丢失')
  })
})


describe('chapter-aware post editor', () => {
  it('only offers chapters the current user may post to', async () => {
    const user = userEvent.setup()
    render(
      <LifePostForm
        initial={{ title: '日常', body: '', chapter_id: 1, tags: [], shot_at: '', visibility: 'public', images: [{ id: 9 }] }}
        selectedCollection={{ id: 1, name: '公有', can_post: true, is_owner: false }}
        collections={{
          owned: [],
          contributing: [{ id: 1, name: '公有', can_post: true, is_owner: false }],
        }}
        onCollectionChange={() => {}}
        onSubmit={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: '重新选择' }))
    expect(screen.getByRole('button', { name: /公有/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /他人的私有/ })).not.toBeInTheDocument()
  })

  it('preserves the current now-private chapter while editing an existing post', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <LifePostForm
        initial={{ title: '已有日常', body: '', chapter_id: 2, tags: [], shot_at: '', visibility: 'public', images: [{ id: 9 }] }}
        selectedCollection={{ id: 2, name: '原合集', can_post: false, is_owner: true }}
        collections={{
          owned: [],
          contributing: [{ id: 1, name: '公有', can_post: true, is_owner: false }],
        }}
        onCollectionChange={() => {}}
        onSubmit={onSubmit}
      />,
    )

    expect(screen.getByText('原合集')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '发布内容' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ chapter_id: 2 }))
  })
})


describe('safe chapter deletion dialog', () => {
  it('shows impact counts and requires a migration target when posts exist', async () => {
    const user = userEvent.setup()
    getLifeChapterDeletionPreview.mockResolvedValue({
      post_count: 12,
      other_author_post_count: 5,
      child_count: 2,
      has_cover: true,
      can_hard_delete: false,
      requires_target: true,
      child_name_conflicts: [],
      eligible_targets: [{ id: 9, name: '归档', contribution_policy: 'public' }],
    })
    deleteLifeChapter.mockResolvedValue({ mode: 'merged', canonical_slug: 'archive' })
    const onDeleted = vi.fn()
    render(
      <ChapterDeleteDialog
        chapter={{ id: 3, name: '北京', is_owner: true }}
        open
        onClose={() => {}}
        onDeleted={onDeleted}
      />,
    )

    expect(await screen.findByText('12 条')).toBeInTheDocument()
    expect(screen.getByText('5 条')).toBeInTheDocument()
    await user.type(screen.getByLabelText('输入完整章节名称确认'), '北京')
    await user.click(screen.getByRole('button', { name: '确认删除' }))
    expect(deleteLifeChapter).not.toHaveBeenCalled()
    await user.selectOptions(screen.getByLabelText('迁移到'), '9')
    await user.click(screen.getByRole('button', { name: '确认删除' }))

    await waitFor(() => expect(deleteLifeChapter).toHaveBeenCalledWith(3, {
      confirmation_name: '北京',
      target_chapter_id: 9,
    }))
    expect(onDeleted).toHaveBeenCalledWith({ mode: 'merged', canonical_slug: 'archive' })
  })
})
