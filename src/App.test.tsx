import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi, beforeEach } from 'vitest'

import App from './App'
import { useTempoState } from './hooks/useTempoState'
import { useIsMobile } from './hooks/useMediaQuery'
import type { TempoSettings, TempoViewModel } from './types'

vi.mock('./hooks/useTempoState', () => ({
  useTempoState: vi.fn(),
}))

vi.mock('./hooks/useMediaQuery', () => ({
  useIsMobile: vi.fn(),
}))

vi.mock('./components/Sidebar', () => ({
  default: () => <div data-testid="sidebar" />,
}))

vi.mock('./components/AppHeader', () => ({
  default: () => <div data-testid="app-header" />,
}))

vi.mock('./components/WeekView', () => ({
  default: () => <div data-testid="week-view" />,
}))

vi.mock('./components/DayView', () => ({
  default: () => <div data-testid="day-view" />,
}))

vi.mock('./components/MonthView', () => ({
  default: () => <div data-testid="month-view" />,
}))

vi.mock('./components/ProjectsView', () => ({
  default: () => <div data-testid="projects-view" />,
}))

vi.mock('./components/CustomersView', () => ({
  default: () => <div data-testid="customers-view" />,
}))

vi.mock('./components/CustomerDetailView', () => ({
  default: () => <div data-testid="customer-detail-view" />,
}))

vi.mock('./components/ProjectDetailView', () => ({
  default: () => <div data-testid="project-detail-view" />,
}))

vi.mock('./components/SettingsView', () => ({
  default: () => <div data-testid="settings-view" />,
}))

vi.mock('./components/Modal', () => ({
  default: () => <div data-testid="modal" />,
}))

vi.mock('./components/Fab', () => ({
  default: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button type="button" aria-label={label} onClick={onClick}>
      {label}
    </button>
  ),
}))

const mockedUseTempoState = vi.mocked(useTempoState)
const mockedUseIsMobile = vi.mocked(useIsMobile)

function makeViewModel(overrides: Partial<TempoViewModel> = {}): TempoViewModel {
  return {
    showWeek: true,
    showDay: false,
    showMonth: false,
    showProjects: false,
    showCustomers: false,
    showSettings: false,
    showCustomerDetail: false,
    showProjectDetail: false,
    showExport: false,
    modalOpen: false,
    sidebarProps: {
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
    },
    headerProps: {
      headerTitle: 'Track',
      headerSubtitle: 'Week',
      isTrack: true,
      isProjects: false,
      isCustomers: false,
      tabDayStyle: {},
      tabWeekStyle: {},
      tabMonthStyle: {},
      onTabDay: vi.fn(),
      onTabWeek: vi.fn(),
      onTabMonth: vi.fn(),
      onPrev: vi.fn(),
      onToday: vi.fn(),
      onNext: vi.fn(),
      btnPrimary: {},
      onNewEntry: vi.fn(),
      onNewProject: vi.fn(),
      onNewCustomer: vi.fn(),
    },
    weekProps: { weekDays: [], gutterStyle: {}, hourRows: [] },
    dayProps: null,
    monthProps: null,
    projectsProps: null,
    customersProps: null,
    settingsProps: null,
    customerDetailProps: null,
    projectDetailProps: null,
    exportProps: null,
    modalProps: null,
    ...overrides,
  }
}

describe('App FAB integration', () => {
  beforeEach(() => {
    mockedUseIsMobile.mockReturnValue(true)
    mockedUseTempoState.mockImplementation((_settings: TempoSettings) => makeViewModel())
  })

  test('shows Add hours on mobile for the track week view', () => {
    mockedUseTempoState.mockReturnValue(makeViewModel())

    render(<App />)

    expect(screen.getByRole('button', { name: 'Add hours' })).toBeInTheDocument()
  })

  test('shows New project on the projects screen', () => {
    mockedUseTempoState.mockReturnValue(makeViewModel({
      showWeek: false,
      showProjects: true,
      headerProps: {
        ...makeViewModel().headerProps,
        isTrack: false,
        isProjects: true,
      },
      weekProps: null,
      projectsProps: { projRows: [], projEmpty: true },
    }))

    render(<App />)

    expect(screen.getByRole('button', { name: 'New project' })).toBeInTheDocument()
  })

  test('hides the FAB on settings and detail screens', () => {
    const scenarios: TempoViewModel[] = [
      makeViewModel({ showWeek: false, showSettings: true, headerProps: { ...makeViewModel().headerProps, isTrack: false }, weekProps: null, settingsProps: {} as TempoViewModel['settingsProps'] }),
      makeViewModel({ showWeek: false, showCustomerDetail: true, headerProps: { ...makeViewModel().headerProps, isTrack: false }, weekProps: null, customerDetailProps: {} as TempoViewModel['customerDetailProps'] }),
      makeViewModel({ showWeek: false, showProjectDetail: true, headerProps: { ...makeViewModel().headerProps, isTrack: false }, weekProps: null, projectDetailProps: {} as TempoViewModel['projectDetailProps'] }),
    ]

    for (const scenario of scenarios) {
      mockedUseTempoState.mockReturnValue(scenario)
      const { unmount } = render(<App />)
      expect(screen.queryByRole('button', { name: /Add hours|New project|New customer/ })).not.toBeInTheDocument()
      unmount()
    }
  })

  test('hides the FAB when a modal is open', () => {
    mockedUseTempoState.mockReturnValue(makeViewModel({
      modalOpen: true,
      modalProps: {} as TempoViewModel['modalProps'],
    }))

    render(<App />)

    expect(screen.queryByRole('button', { name: 'Add hours' })).not.toBeInTheDocument()
  })
})
