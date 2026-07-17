import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import AppHeader from './AppHeader'
import type { AppHeaderProps } from '../types'

function makeProps(overrides: Partial<AppHeaderProps> = {}): AppHeaderProps {
  return {
    headerTitle: 'Clock',
    headerSubtitle: 'Week of 1 Jul',
    isClock: true,
    isProjects: false,
    isServices: false,
    isCustomers: false,
    onPrev: vi.fn(),
    onToday: vi.fn(),
    onNext: vi.fn(),
    btnPrimary: {},
    onNewEntry: vi.fn(),
    onNewProject: vi.fn(),
    onNewService: vi.fn(),
    onNewCustomer: vi.fn(),
    onToggleSidebar: vi.fn(),
    sidebarOpen: false,
    ...overrides,
  }
}

describe('AppHeader', () => {
  test('renders the hamburger only on mobile', () => {
    const { rerender } = render(<AppHeader {...makeProps({ isMobile: true })} />)

    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument()

    rerender(<AppHeader {...makeProps()} />)

    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument()
  })

  test('reflects sidebar state in aria-expanded', () => {
    render(<AppHeader {...makeProps({ isMobile: true, sidebarOpen: true })} />)

    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'true')
  })

  test('calls onToggleSidebar when the hamburger is clicked', async () => {
    const user = userEvent.setup()
    const onToggleSidebar = vi.fn()

    render(<AppHeader {...makeProps({ isMobile: true, onToggleSidebar })} />)
    await user.click(screen.getByRole('button', { name: 'Open menu' }))

    expect(onToggleSidebar).toHaveBeenCalledTimes(1)
  })

  test('hides the primary clock CTA on mobile and shows it on desktop', () => {
    const { rerender } = render(<AppHeader {...makeProps({ isMobile: true })} />)

    expect(screen.queryByRole('button', { name: '+ Log entry' })).not.toBeInTheDocument()

    rerender(<AppHeader {...makeProps({ isMobile: false })} />)

    expect(screen.getByRole('button', { name: '+ Log entry' })).toBeInTheDocument()
  })
})
