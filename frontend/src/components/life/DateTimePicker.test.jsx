import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import DateTimePicker from './DateTimePicker.jsx'


describe('date time picker', () => {
  it('selects a date and time through the custom calendar', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DateTimePicker value="2026-07-29T13:24" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /2026年7月29日/ }))
    expect(screen.getByRole('dialog', { name: '选择拍摄或发生时间' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '2026年7月15日' }))
    await user.selectOptions(screen.getByLabelText('小时'), '18')
    await user.selectOptions(screen.getByLabelText('分钟'), '36')
    await user.click(screen.getByRole('button', { name: '确定' }))

    expect(onChange).toHaveBeenCalledWith('2026-07-15T18:36')
    expect(screen.queryByRole('dialog', { name: '选择拍摄或发生时间' })).not.toBeInTheDocument()
  })

  it('can clear an optional value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DateTimePicker value="2026-07-29T13:24" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /2026年7月29日/ }))
    await user.click(screen.getByRole('button', { name: '清除' }))

    expect(onChange).toHaveBeenCalledWith('')
  })
})
