import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi, beforeEach } from 'vitest'

import App from './App'
import { useAppState } from './hooks/useAppState'
import { useIsMobile } from './hooks/useMediaQuery'
import type { AppSettings, AppViewModel } from './types'

vi.mock('./hooks/useAppState', () => ({
  useAppState: vi.fn(),
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

vi.mock('./components/TrackView', () => ({
  default: () => <div data-testid="track-view" />,
}))

vi.mock('./components/ProjectsView', () => ({
  default: () => <div data-testid="projects-view" />,
}))

vi.mock('./components/ServicesView', () => ({
  default: () => <div data-testid="services-view" />,
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

vi.mock('./components/ServiceDetailView', () => ({
  default: () => <div data-testid="service-detail-view" />,
}))

vi.mock('./components/SettingsView', () => ({
  default: () => <div data-testid="settings-view" />,
}))

vi.mock('./components/ExportView', () => ({
  default: () => <div data-testid="export-view" />,
}))

vi.mock('./components/EarningsView', () => ({
  default: () => <div data-testid="earnings-view" />,
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

const mockedUseAppState = vi.mocked(useAppState)
const mockedUseIsMobile = vi.mocked(useIsMobile)

function makeViewModel(overrides: Partial<AppViewModel> = {}): AppViewModel {
  return {
    showTrack: true,
    showProjects: false,
    showServices: false,
    showCustomers: false,
    showSettings: false,
    showCustomerDetail: false,
    showProjectDetail: false,
    showServiceDetail: false,
    showExport: false,
    showEarnings: false,
    modalOpen: false,
    sidebarProps: {
      logoStyle: {},
      navTrackStyle: {},
      navProjectsStyle: {},
      navServicesStyle: {},
      navCustomersStyle: {},
      navExportStyle: {},
      navEarningsStyle: {},
      onNavTrack: vi.fn(),
      onNavProjects: vi.fn(),
      onNavServices: vi.fn(),
      onNavCustomers: vi.fn(),
      onNavExport: vi.fn(),
      onNavEarnings: vi.fn(),
      monthHours: '0h',
      monthDaysStr: '0',
      monthEarnStr: '€0',
      periodLabel: 'This week',
      syncColor: '#9ca3af',
      syncLabel: 'Saved in browser',
      syncStatus: 'idle',
      onOpenSettings: vi.fn(),
      accent: '#2563eb',
      isAuthenticated: true,
      onSignIn: vi.fn(),
    },
    headerProps: {
      headerTitle: 'Track',
      headerSubtitle: 'Week',
      isTrack: true,
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
    },
    trackProps: {
      calendar: {
        monthLabel: 'July 2026',
        dowLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        weeks: [],
        summary: { hoursLabel: '0h', daysLabel: '0', earnLabel: '€0', entryCountLabel: '0' },
        panel: { mode: 'glance', topProjects: [], filterLabel: null, onClearFilter: () => {}, onAddEntry: () => {} },
        onPrevMonth: () => {},
        onNextMonth: () => {},
        onToday: () => {},
      },
      accent: '#2563eb',
    },
    projectsProps: null,
    servicesProps: null,
    customersProps: null,
    settingsProps: null,
    customerDetailProps: null,
    projectDetailProps: null,
    serviceDetailProps: null,
    exportProps: null,
    earningsProps: null,
    modalProps: null,
    ...overrides,
  }
}

describe('App FAB integration', () => {
  beforeEach(() => {
    mockedUseIsMobile.mockReturnValue(true)
    mockedUseAppState.mockImplementation((_settings: AppSettings) => makeViewModel())
  })

  test('shows Add hours on mobile for the track week view', () => {
    mockedUseAppState.mockReturnValue(makeViewModel())

    render(<App />)

    expect(screen.getByRole('button', { name: 'Add hours' })).toBeInTheDocument()
  })

  test('shows New project on the projects screen', () => {
    mockedUseAppState.mockReturnValue(makeViewModel({
      showTrack: false,
      showProjects: true,
      headerProps: {
        ...makeViewModel().headerProps,
        isTrack: false,
        isProjects: true,
      },
      trackProps: null,
      projectsProps: { activeRows: [], closedRows: [], projEmpty: true },
    }))

    render(<App />)

    expect(screen.getByRole('button', { name: 'New project' })).toBeInTheDocument()
  })

  test('shows New service on the services screen', () => {
    mockedUseAppState.mockReturnValue(makeViewModel({
      showTrack: false,
      showServices: true,
      headerProps: {
        ...makeViewModel().headerProps,
        isTrack: false,
        isServices: true,
      },
      trackProps: null,
      servicesProps: { serviceRows: [], serviceEmpty: true },
    }))

    render(<App />)

    expect(screen.getByRole('button', { name: 'New service' })).toBeInTheDocument()
  })

  test('hides the FAB on settings and detail screens', () => {
    const scenarios: AppViewModel[] = [
      makeViewModel({ showTrack: false, showSettings: true, headerProps: { ...makeViewModel().headerProps, isTrack: false }, trackProps: null, settingsProps: {} as AppViewModel['settingsProps'] }),
      makeViewModel({ showTrack: false, showCustomerDetail: true, headerProps: { ...makeViewModel().headerProps, isTrack: false }, trackProps: null, customerDetailProps: {} as AppViewModel['customerDetailProps'] }),
      makeViewModel({ showTrack: false, showProjectDetail: true, headerProps: { ...makeViewModel().headerProps, isTrack: false }, trackProps: null, projectDetailProps: {} as AppViewModel['projectDetailProps'] }),
      makeViewModel({ showTrack: false, showServiceDetail: true, headerProps: { ...makeViewModel().headerProps, isTrack: false }, trackProps: null, serviceDetailProps: {} as AppViewModel['serviceDetailProps'] }),
    ]

    for (const scenario of scenarios) {
      mockedUseAppState.mockReturnValue(scenario)
      const { unmount } = render(<App />)
      expect(screen.queryByRole('button', { name: /Add hours|New project|New service|New customer/ })).not.toBeInTheDocument()
      unmount()
    }
  })

  test('hides the FAB when a modal is open', () => {
    mockedUseAppState.mockReturnValue(makeViewModel({
      modalOpen: true,
      modalProps: {} as AppViewModel['modalProps'],
    }))

    render(<App />)

    expect(screen.queryByRole('button', { name: 'Add hours' })).not.toBeInTheDocument()
  })
})
