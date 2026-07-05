import { type FC, Suspense, lazy, useEffect, useState } from 'react';
import { useAppState } from './hooks/useAppState';
import { useIsMobile } from './hooks/useMediaQuery';
import type { AppSettings } from './types';
import Sidebar from './components/Sidebar';
import AppHeader from './components/AppHeader';
import TrackView from './components/TrackView';
import ProjectsView from './components/ProjectsView';
import ServicesView from './components/ServicesView';
import CustomersView from './components/CustomersView';
import CustomerDetailView from './components/CustomerDetailView';
import ProjectDetailView from './components/ProjectDetailView';
import ServiceDetailView from './components/ServiceDetailView';
import SettingsView from './components/SettingsView';
import Modal from './components/Modal';
import Fab from './components/Fab';

// Loaded on demand: pulls in pdf-lib/jszip, which are only needed once the
// user actually opens the export page.
const ExportView = lazy(() => import('./components/ExportView'));
const EarningsView = lazy(() => import('./components/EarningsView'));

// App-level settings (accent colour, hours-per-day, show-weekend toggle).
const SETTINGS: AppSettings = {
  accentColor: '#2563eb',
  hoursPerDay: 8,
  showWeekend: false,
};

const App: FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const {
    showTrack,
    showProjects,
    showServices,
    showCustomers,
    showCustomerDetail,
    showProjectDetail,
    showServiceDetail,
    showSettings,
    showExport,
    showEarnings,
    modalOpen,
    sidebarProps,
    headerProps,
    trackProps,
    projectsProps,
    servicesProps,
    customersProps,
    customerDetailProps,
    projectDetailProps,
    serviceDetailProps,
    settingsProps,
    exportProps,
    earningsProps,
    modalProps,
  } = useAppState(SETTINGS);

  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  const fabConfig = !modalOpen && !sidebarOpen
    ? headerProps.isTrack
      ? { label: 'Add hours', onClick: headerProps.onNewEntry }
      : showProjects
        ? { label: 'New project', onClick: headerProps.onNewProject }
        : showServices
          ? { label: 'New service', onClick: headerProps.onNewService }
        : showCustomers
          ? { label: 'New customer', onClick: headerProps.onNewCustomer }
          : null
    : null;

  return (
    <div className="app-shell" style={{ display: 'flex', width: '100%', overflow: 'hidden' }}>
      <Sidebar {...sidebarProps} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {isMobile && sidebarOpen && <div className="drawer-backdrop" onClick={() => setSidebarOpen(false)} />}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--color-background)' }}>
        <AppHeader
          {...headerProps}
          isMobile={isMobile}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
        />

        {showTrack && trackProps && <TrackView {...trackProps} />}
        {showProjects && projectsProps && <ProjectsView {...projectsProps} />}
        {showServices && servicesProps && <ServicesView {...servicesProps} />}
        {showCustomers && customersProps && <CustomersView {...customersProps} />}
        {showCustomerDetail && customerDetailProps && <CustomerDetailView {...customerDetailProps} />}
        {showProjectDetail && projectDetailProps && <ProjectDetailView {...projectDetailProps} />}
        {showServiceDetail && serviceDetailProps && <ServiceDetailView {...serviceDetailProps} />}
        {showSettings && settingsProps && <SettingsView {...settingsProps} />}
        {showExport && exportProps && (
          <Suspense fallback={<div style={{ padding: '26px', color: '#626873' }}>Loading export…</div>}>
            <ExportView {...exportProps} />
          </Suspense>
        )}
        {showEarnings && earningsProps && (
          <Suspense fallback={<div style={{ padding: '26px', color: '#626873' }}>Loading earnings…</div>}>
            <EarningsView {...earningsProps} />
          </Suspense>
        )}
      </main>

      {isMobile && fabConfig && <Fab label={fabConfig.label} onClick={fabConfig.onClick} />}

      {modalOpen && modalProps && <Modal {...modalProps} />}
    </div>
  );
};

export default App;
