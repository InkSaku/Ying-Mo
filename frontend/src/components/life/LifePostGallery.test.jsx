import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import LifePostGallery from './LifePostGallery.jsx'

const cover = {
  id: 1,
  media_type: 'image',
  url: 'https://example.test/cover.webp',
  thumbnail_url: 'https://example.test/cover-thumb.webp',
  width: 1600,
  height: 900,
}

const images = [
  {
    id: 2,
    media_type: 'image',
    url: 'https://example.test/two.webp',
    thumbnail_url: 'https://example.test/two-thumb.webp',
    width: 1200,
    height: 800,
  },
  {
    id: 3,
    media_type: 'image',
    url: 'https://example.test/three.webp',
    thumbnail_url: 'https://example.test/three-thumb.webp',
    width: 900,
    height: 1200,
  },
]

describe('LifePostGallery', () => {
  it('includes the cover in keyboard and thumbnail navigation and restores focus', async () => {
    const user = userEvent.setup()
    render(<LifePostGallery cover={cover} images={images} title="夏日图集" />)

    const coverButton = screen.getByRole('button', { name: '放大查看夏日图集的封面' })
    await user.click(coverButton)

    expect(screen.getByRole('dialog', { name: '放大图片查看，第 1 张，共 3 张' })).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')
    expect(screen.getByRole('button', { name: '查看第 1 张照片' })).toHaveAttribute('aria-current', 'true')

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('dialog', { name: '放大图片查看，第 2 张，共 3 张' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '查看第 3 张照片' }))
    expect(screen.getByRole('dialog', { name: '放大图片查看，第 3 张，共 3 张' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看第 3 张照片' })).toHaveAttribute('aria-current', 'true')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(coverButton).toHaveFocus())
    expect(document.body.style.overflow).toBe('')
  })
})
