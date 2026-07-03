import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import Sidebar from './Sidebar'
import type { SidebarProps } from '../types'

function makeProps(overrides: Partial<SidebarProps> = {}): SidebarProps {
  return {
    logoStyle: {},
    navTrackStyle: {},
    navProjectsStyle: {},
    navCustomersStyle: {},
    navExportStyle: {},
    onNavTrack: vi.fn(),
    onNavProjects: vi.fn(),
    onNavCustomers: vi.fn(),
    onNavExport: vi.fn(),
    weekHours: '0h',
    weekDaysStr: '0',
    weekEarnStr: '€0',
    syncColor: '#9ca3af',
    syncLabel: 'Saved in browser',
    onOpenSettings: vi.fn(),
    ...overrides,
  }
}

describe('Sidebar', () => {
  test('adds the open-state class when isOpen is true', () => {
    const { container, rerender } = render(<Sidebar {...makeProps({ isOpen: true })} />)

    expect(container.querySelector('.sidebar')).toHaveClass('sidebar--open')

    rerender(<Sidebar {...makeProps({ isOpen: false })} />)

    expect(container.querySelector('.sidebar')).not.toHaveClass('sidebar--open')
  })

  test('clicking a navigation item calls its handler and onClose', async () => {
    const user = userEvent.setup()
    const onNavTrack = vi.fn()
    const onClose = vi.fn()

    render(<Sidebar {...makeProps({ onNavTrack, onClose })} />)
    await user.click(screen.getByRole('button', { name: 'Track' }))

    expect(onNavTrack).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
