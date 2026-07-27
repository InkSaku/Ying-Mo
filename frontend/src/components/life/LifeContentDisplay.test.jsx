import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import LifePostCard from './LifePostCard.jsx'
import MarkdownContent from './MarkdownContent.jsx'

const basePost = {
  id: 1,
  title: null,
  excerpt: '这是一条没有标题的纯文字记录。',
  content_format: 'plain',
  has_external_video: false,
  cover_image: null,
  image_count: 0,
  media_count: 0,
  live_video_count: 0,
  author: { nickname: '映墨用户' },
  chapter: { name: '个人日记' },
  created_at: '2026-07-27T08:00:00Z',
}

describe('life content display', () => {
  it('renders a text card without an empty media or title area', () => {
    const { container } = render(
      <MemoryRouter><LifePostCard post={basePost} /></MemoryRouter>,
    )

    expect(screen.getByText(basePost.excerpt)).toBeInTheDocument()
    expect(container.querySelector('.life-card__media')).not.toBeInTheDocument()
    expect(container.querySelector('.life-card__body > strong')).not.toBeInTheDocument()
  })

  it('renders GFM Markdown and keeps raw HTML inert', () => {
    const { container } = render(
      <MarkdownContent>{'# 标题\n\n~~删除~~\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n<script>alert(1)</script>'}</MarkdownContent>,
    )

    expect(screen.getByRole('heading', { name: '标题' })).toBeInTheDocument()
    expect(container.querySelector('del')).toHaveTextContent('删除')
    expect(container.querySelector('table')).toBeInTheDocument()
    expect(container.querySelector('script')).not.toBeInTheDocument()
  })

  it('renders authenticated inline media between Markdown paragraphs', () => {
    const { container } = render(
      <MarkdownContent
        media={[{
          id: 9,
          public_id: '12345678-1234-1234-1234-123456789abc',
          media_type: 'image',
          url: 'https://example.test/inline.webp',
          width: 1200,
          height: 800,
        }]}
        title="图文日记"
      >
        {'图片之前\n\n{{yingmo-media:12345678-1234-1234-1234-123456789abc|海边日落}}\n\n图片之后'}
      </MarkdownContent>,
    )

    expect(screen.getByText('图片之前')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '海边日落' })).toHaveAttribute(
      'src',
      'https://example.test/inline.webp',
    )
    expect(container.querySelector('figcaption')).toHaveTextContent('海边日落')
    expect(screen.getByText('图片之后')).toBeInTheDocument()
  })

  it('renders an inline Live Photo with the existing player', () => {
    render(
      <MarkdownContent
        media={[{
          id: 10,
          public_id: '87654321-4321-4321-4321-cba987654321',
          media_type: 'live_video',
          thumbnail_url: 'https://example.test/live-thumb.webp',
          width: 1080,
          height: 1440,
          duration_ms: 1800,
        }]}
        title="实况日记"
      >
        {'实况之前\n\n{{yingmo-media:87654321-4321-4321-4321-cba987654321|夏夜实况}}\n\n实况之后'}
      </MarkdownContent>,
    )

    expect(screen.getByText('实况之前')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /播放夏夜实况/ })).toBeInTheDocument()
    expect(screen.getByText('实况之后')).toBeInTheDocument()
  })
})
