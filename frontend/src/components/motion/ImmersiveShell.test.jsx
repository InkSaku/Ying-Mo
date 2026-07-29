import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import ImmersiveShell from './ImmersiveShell.jsx'

describe('ImmersiveShell', () => {
  it('tracks fine-pointer coordinates without changing page content', () => {
    const { container } = render(
      <ImmersiveShell>
        <main>映墨内容</main>
      </ImmersiveShell>,
    )
    const shell = container.querySelector('.app-shell')

    fireEvent.pointerMove(shell, {
      clientX: 320,
      clientY: 180,
      pointerType: 'mouse',
    })

    expect(shell).toHaveStyle({
      '--ambient-x': '320px',
      '--ambient-y': '180px',
    })
    expect(container.querySelector('.immersive-ambient')).toHaveAttribute('aria-hidden', 'true')
  })

  it('ignores touch movement', () => {
    const { container } = render(<ImmersiveShell><main>映墨内容</main></ImmersiveShell>)
    const shell = container.querySelector('.app-shell')

    fireEvent.pointerMove(shell, {
      clientX: 100,
      clientY: 80,
      pointerType: 'touch',
    })

    expect(shell.style.getPropertyValue('--ambient-x')).toBe('')
    expect(shell.style.getPropertyValue('--ambient-y')).toBe('')
  })
})
