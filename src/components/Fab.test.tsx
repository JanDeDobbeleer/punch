import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import Fab from './Fab'

describe('Fab', () => {
  test('uses the label as its accessible name', () => {
    render(<Fab label="Add hours" onClick={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Add hours' })).toBeInTheDocument()
  })

  test('calls onClick when pressed', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(<Fab label="Add hours" onClick={onClick} />)
    await user.click(screen.getByRole('button', { name: 'Add hours' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test('applies the provided background color and defaults to accent blue', () => {
    const { rerender } = render(<Fab label="Add hours" onClick={vi.fn()} background="#111111" />)

    expect(screen.getByRole('button', { name: 'Add hours' })).toHaveStyle({ background: '#111111' })

    rerender(<Fab label="Add hours" onClick={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Add hours' })).toHaveStyle({ background: '#2563eb' })
  })
})
