import { type FC, Suspense, lazy, useEffect, useState } from 'react';
import { useTempoState } from './hooks/useTempoState';
import { useIsMobile } from './hooks/useMediaQuery';
import type { TempoSettings } from './types';
import Sidebar from './components/Sidebar';
import AppHeader from './components/AppHeader';
import WeekView from './components/WeekView';
import DayView from './components/DayView';
import MonthView from './components/MonthView';
import ProjectsView from './components/ProjectsView';
import CustomersView from './components/CustomersView';
import CustomerDetailView from './components/CustomerDetailView';
import ProjectDetailView from './components/ProjectDetailView';
import SettingsView from './components/SettingsView';
import Modal from './components/Modal';
import Fab from './components/Fab';

// Loaded on demand: pulls in pdf-lib/jszip, which are only needed once the
// user actually opens the export page.
const ExportView = lazy(() => import('./components/ExportView'));

// Mirrors the DC root's editable-settings defaults (see Tempo.dc.html's
// data-props block: accentColor / hoursPerDay / showWeekend).
const SETTINGS: TempoSettings = {
  accentColor: '#2563eb',
  hoursPerDay: 8,
  showWeekend: false,
};

const App: FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const {
    showWeek,
    showDay,
    showMonth,
    showProjects,
    showCustomers,
    showCustomerDetail,
    showProjectDetail,
    showSettings,
    showExport,
    modalOpen,
    sidebarProps,
    headerProps,
    weekProps,
    dayProps,
    monthProps,
    projectsProps,
    customersProps,
    customerDetailProps,
    projectDetailProps,
    settingsProps,
    exportProps,
    modalProps,
  } = useTempoState(SETTINGS);

  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  const fabConfig = !modalOpen
    ? headerProps.isTrack
      ? { label: 'Add hours', onClick: headerProps.onNewEntry }
      : showProjects
        ? { label: 'New project', onClick: headerProps.onNewProject }
        : showCustomers
          ? { label: 'New customer', onClick: headerProps.onNewCustomer }
          : null
    : null;

  return (
    <div className="app-shell" style={{ display: 'flex', width: '100%', overflow: 'hidden' }}>
      <Sidebar {...sidebarProps} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {isMobile && sidebarOpen && <div className="drawer-backdrop" onClick={() => setSidebarOpen(false)} />}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#f5f6f8' }}>
        <AppHeader
          {...headerProps}
          isMobile={isMobile}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
        />

        {showWeek && weekProps && <WeekView {...weekProps} />}
        {showDay && dayProps && <DayView {...dayProps} />}
        {showMonth && monthProps && <MonthView {...monthProps} />}
        {showProjects && projectsProps && <ProjectsView {...projectsProps} />}
        {showCustomers && customersProps && <CustomersView {...customersProps} />}
        {showCustomerDetail && customerDetailProps && <CustomerDetailView {...customerDetailProps} />}
        {showProjectDetail && projectDetailProps && <ProjectDetailView {...projectDetailProps} />}
        {showSettings && settingsProps && <SettingsView {...settingsProps} />}
        {showExport && exportProps && (
          <Suspense fallback={<div style={{ padding: '26px', color: '#626873' }}>Loading export…</div>}>
            <ExportView {...exportProps} />
          </Suspense>
        )}
      </main>

      {isMobile && fabConfig && <Fab label={fabConfig.label} onClick={fabConfig.onClick} />}

      {modalOpen && modalProps && <Modal {...modalProps} />}
    </div>
  );
};

export default App;
