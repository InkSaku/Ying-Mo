import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

describe('frontend test foundation', () => {
  it('renders React content and handles a user interaction', async () => {
    const user = userEvent.setup()
    render(<button type="button">测试交互</button>)

    const button = screen.getByRole('button', { name: '测试交互' })
    await user.click(button)

    expect(button).toBeInTheDocument()
  })
})
