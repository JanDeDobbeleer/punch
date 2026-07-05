import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type MouseEvent } from 'react';

const DEV_MODE = import.meta.env.DEV;

import { addDays, addMonths, fmtFullDate, fmtMonthYear, fmtShortDateYear, iso, isoWeekNumber, parseISO, startOfWeek } from '../lib/dates';
import { fmtEUR, fmtH, fmtDays, fmtBytes, hexToRgba, hoursToMinutes, minutesToHours, uid } from '../lib/format';
import { addRatePeriod, currentRatePeriod, hasOverlap, rateForDate, sortRates } from '../lib/rates';
import * as store from '../lib/store';
import type {
  AppHeaderProps,
  ColorSwatchVM,
  Customer,
  CustomerDetailProjectRowVM,
  CustomerDetailViewProps,
  CustomerForm,
  CustomersViewProps,
  EarningsFilterSeed,
  EarningsViewProps,
  Entry,
  EntryDetailRowVM,
  EntryForm,
  ExportScope,
  ExportViewProps,
  ModalProps,
  ModalState,
  Page,
  PersistedData,
  Project,
  ProjectDetailViewProps,
  ProjectForm,
  ProjectsViewProps,
  RatePeriod,
  RatePeriodRowVM,
  Service,
  ServiceDetailViewProps,
  ServiceForm,
  ServicesViewProps,
  SettingsViewProps,
  SidebarProps,
  SyncStatus,
  AppSettings,
  AppViewModel,
  ClockDayEntryVM,
  ClockDayPanelVM,
  ClockMonthDayVM,
  ClockMonthGlanceProjectVM,
  ClockMonthGlanceVM,
  ClockWeekRowVM,
  ClockViewProps,
} from '../types';

const PALETTE = ['#1e5667', '#0d9488', '#7c3aed', '#d97706', '#db2777', '#65a30d', '#0891b2', '#dc2626'];

function colorForProject(project: Project | undefined, custById: Record<string, Customer>): string {
  if (!project) {
    return '#9ca3af';
  }
  return custById[project.customerId]?.color || '#9ca3af';
}

function colorForServiceEntry(entry: Entry, custById: Record<string, Customer>): string {
  return entry.customerId ? (custById[entry.customerId]?.color || '#9ca3af') : '#9ca3af';
}

function colorForEntry(
  entry: Entry,
  projById: Record<string, Project>,
  custById: Record<string, Customer>,
): string {
  return entry.kind === 'service' || entry.kind === 'customer'
    ? colorForServiceEntry(entry, custById)
    : colorForProject(projById[entry.projectId ?? ''], custById);
}

type AppState = PersistedData & {
  page: Page;
  refISO: string;
  modal: ModalState | null;
  demoMode: boolean;
  syncStatus: SyncStatus;
  stateEtag: string;
  // Per-year tracking for lazy-loaded past years.
  // `loadedYears` lists every year whose entries are present in `entries`.
  // `yearEtags` holds the blob ETag for each loaded year != currentYear.
  loadedYears: number[];
  yearEtags: Record<number, string>;
  attachmentUploading: boolean;
  attachmentError: string;
  userDisplayName: string;
  isAuthenticated: boolean;
  selectedCustomerId: string | null;
  selectedProjectId: string | null;
  selectedServiceId: string | null;
  projectDraft: ProjectForm | null;
  projectOrigin: ProjectOrigin | null;
  serviceDraft: ServiceForm | null;
  exportScope: ExportScope | null;
  earningsFilter: EarningsFilterSeed | null;
};

type ProjectOrigin = { page: 'projects' } | { page: 'customerDetail'; customerId: string };
type EntryDraft = Pick<Entry, 'kind' | 'projectId' | 'serviceId' | 'customerId' | 'date' | 'minutes' | 'comment'> & Partial<Pick<Entry, 'id' | 'attachments' | 'amount'>>;

type RenderCtx = {
  S: AppState;
  acc: string;
  hpd: number;
  showWeekend: boolean;
  ref: Date;
  todayISO: string;
  projById: Record<string, Project>;
  serviceById: Record<string, Service>;
  custById: Record<string, Customer>;
  entryEarn: (entry: Entry) => number;
  isClock: boolean;
  isProjects: boolean;
  isServices: boolean;
  isCustomers: boolean;
  isSettings: boolean;
  isCustomerDetail: boolean;
  isProjectDetail: boolean;
  isServiceDetail: boolean;
  isExport: boolean;
  isEarnings: boolean;
  navSection: 'clock' | 'projects' | 'services' | 'customers' | 'settings' | 'export' | 'earnings';
  calendarAnchor: Date;
  selectedClockDayISO: string | null;
  calendarFilterKey: string | null;
};

function getHoursPerDay(settings: AppSettings): number {
  const value = Number(settings.hoursPerDay);
  return value > 0 ? value : 8;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function navStyle(active: boolean, accent: string): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    minHeight: '44px',
    padding: '9px 11px',
    borderRadius: '9px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13.5px',
    letterSpacing: '-0.01em',
    textAlign: 'left',
    fontWeight: active ? 600 : 500,
    background: active ? hexToRgba(accent, 0.1) : 'transparent',
    color: active ? accent : '#374151',
  };
}

function createEmptyData(): PersistedData {
  return {
    customers: [],
    projects: [],
    services: [],
    entries: [],
  };
}

function createStateFromData(data: PersistedData, demoMode: boolean): AppState {
  const today = new Date();
  const currentYear = today.getFullYear();

  return {
    page: 'clock',
    refISO: iso(today),
    customers: data.customers,
    projects: data.projects,
    services: data.services,
    entries: data.entries,
    modal: null,
    demoMode,
    syncStatus: 'idle',
    stateEtag: '',
    loadedYears: [currentYear],
    yearEtags: {},
    attachmentUploading: false,
    attachmentError: '',
    userDisplayName: '',
    isAuthenticated: true,
    selectedCustomerId: null,
    selectedProjectId: null,
    selectedServiceId: null,
    projectDraft: null,
    projectOrigin: null,
    serviceDraft: null,
    exportScope: null,
    earningsFilter: null,
  };
}

function makeProjectEntry(
  id: string,
  date: string,
  projectId: string,
  minutes: number,
  comment: string,
): Entry {
  return { id, kind: 'project', date, projectId, serviceId: null, customerId: null, amount: null, minutes, comment, attachments: [] };
}

function createDemoSeed(): PersistedData {
  const customers: Customer[] = [
    { id: 'c1', name: 'Northwind Studio', color: '#1e5667' },
    { id: 'c2', name: 'Meridian Health', color: '#7c3aed' },
    { id: 'c3', name: 'Atlas Logistics', color: '#db2777' },
  ];
  const seedRate = (id: string, amount: number): RatePeriod[] => [{ id, amount, from: '2020-01-01', to: null }];
  const projects: Project[] = [
    { id: 'p1', name: 'Website Redesign', customerId: 'c1', rates: seedRate('r1', 650) },
    { id: 'p2', name: 'Mobile App', customerId: 'c1', rates: seedRate('r2', 720) },
    { id: 'p3', name: 'Brand System', customerId: 'c2', rates: seedRate('r3', 800) },
    { id: 'p4', name: 'Analytics Dashboard', customerId: 'c2', rates: seedRate('r4', 680) },
    { id: 'p5', name: 'Logistics Portal', customerId: 'c3', rates: seedRate('r5', 600) },
  ];

  // Seed entries for the current week and the previous three weeks so the
  // month view is populated regardless of what day of the month it is.
  const thisWeek = startOfWeek(new Date());
  const d = (weekOffset: number, dayOffset: number): string =>
    iso(addDays(addDays(thisWeek, weekOffset * 7), dayOffset));

  return {
    customers,
    projects,
    services: [
      { id: 's1', name: 'Workshop', rates: seedRate('sr1', 1200) },
      { id: 's2', name: 'Training', rates: seedRate('sr2', 900) },
    ],
    entries: [
      // Current week (Mon–Fri)
      makeProjectEntry('e1',  d(0, 0), 'p1', 210, 'Wireframe review & IA'),
      makeProjectEntry('e2',  d(0, 0), 'p3', 150, 'Logo exploration'),
      makeProjectEntry('e3',  d(0, 1), 'p2', 150, 'Onboarding flow'),
      makeProjectEntry('e4',  d(0, 1), 'p4', 210, 'Charts components'),
      makeProjectEntry('e5',  d(0, 2), 'p1', 240, 'Homepage build'),
      makeProjectEntry('e6',  d(0, 2), 'p5', 120, 'API field mapping'),
      { id: 'e7',  kind: 'service', date: d(0, 3), projectId: null, serviceId: 's1', customerId: 'c2', amount: null, minutes: 120, comment: 'Workshop facilitation', attachments: [] },
      makeProjectEntry('e8',  d(0, 3), 'p2', 240, 'Push notifications'),
      makeProjectEntry('e9',  d(0, 4), 'p1', 150, 'QA & polish'),
      { id: 'e10', kind: 'service', date: d(0, 4), projectId: null, serviceId: 's2', customerId: 'c1', amount: null, minutes: 150, comment: 'Team training', attachments: [] },
      // Previous week (Mon–Fri)
      makeProjectEntry('e11', d(-1, 0), 'p3', 240, 'Typography & colour tokens'),
      makeProjectEntry('e12', d(-1, 1), 'p4', 210, 'Axis labels & tooltips'),
      makeProjectEntry('e13', d(-1, 1), 'p1', 150, 'Responsive nav'),
      makeProjectEntry('e14', d(-1, 2), 'p2', 240, 'Deep-link routing'),
      makeProjectEntry('e15', d(-1, 3), 'p5', 180, 'Driver assignment UI'),
      makeProjectEntry('e16', d(-1, 4), 'p3', 120, 'Icon set review'),
      { id: 'e17', kind: 'service', date: d(-1, 4), projectId: null, serviceId: 's1', customerId: 'c3', amount: null, minutes: 120, comment: 'Process workshop', attachments: [] },
      // Two weeks ago (Mon–Fri)
      makeProjectEntry('e18', d(-2, 0), 'p1', 270, 'Component library setup'),
      makeProjectEntry('e19', d(-2, 1), 'p4', 180, 'KPI card designs'),
      makeProjectEntry('e20', d(-2, 2), 'p2', 210, 'Auth & permissions'),
      makeProjectEntry('e21', d(-2, 3), 'p3', 150, 'Print style guide'),
      makeProjectEntry('e22', d(-2, 4), 'p5', 240, 'Route optimisation spec'),
      // Three weeks ago (Mon–Fri)
      makeProjectEntry('e23', d(-3, 0), 'p2', 180, 'User research synthesis'),
      makeProjectEntry('e24', d(-3, 1), 'p1', 210, 'Hero section design'),
      makeProjectEntry('e25', d(-3, 2), 'p4', 150, 'Filter & search UI'),
      makeProjectEntry('e26', d(-3, 3), 'p5', 120, 'API contract review'),
      { id: 'e27', kind: 'service', date: d(-3, 4), projectId: null, serviceId: 's2', customerId: 'c2', amount: null, minutes: 150, comment: 'Stakeholder training', attachments: [] },
    ],
  };
}

// Demo data is considered stale when all its entries are older than 4 weeks.
// In that case the seed is regenerated so the Clock calendar never looks empty.
function isDemoDataFresh(data: PersistedData): boolean {
  if (data.entries.length === 0) {
    return false;
  }
  const cutoffISO = iso(addDays(new Date(), -28));
  return data.entries.some((entry) => entry.date >= cutoffISO);
}

function loadOrCreateDemoData(): PersistedData {
  const saved = store.loadDemoData();
  if (saved && isDemoDataFresh(saved)) {
    return saved;
  }

  const seed = createDemoSeed();
  store.saveDemoData(seed);
  return seed;
}

function getStoreData(demoMode: boolean): PersistedData {
  if (demoMode) {
    return loadOrCreateDemoData();
  }

  const data = store.loadData() || createEmptyData();
  // Filter to current year only. The localStorage cache may contain entries from
  // multiple years (pre-split), but the hook only loads the current year on startup;
  // past years are fetched lazily when the user navigates to them.
  const currentYear = new Date().getFullYear();
  return {
    ...data,
    entries: data.entries.filter((e) => new Date(e.date).getFullYear() === currentYear),
  };
}

function getSyncStatusMeta(demoMode: boolean, syncStatus: SyncStatus): { label: string; color: string } {
  if (DEV_MODE && demoMode) {
    return { label: 'Local (demo mode)', color: '#9ca3af' };
  }

  if (DEV_MODE) {
    return { label: 'Local (dev mode)', color: '#9ca3af' };
  }

  if (demoMode) {
    return { label: 'Demo mode (not synced)', color: '#9ca3af' };
  }

  if (syncStatus === 'syncing') {
    return { label: 'Syncing…', color: '#9ca3af' };
  }

  if (syncStatus === 'synced') {
    return { label: 'Synced', color: '#16a34a' };
  }

  if (syncStatus === 'conflict') {
    return { label: 'Reloaded newer data', color: '#d97706' };
  }

  if (syncStatus === 'error') {
    return { label: 'Sync failed', color: '#dc2626' };
  }

  return { label: 'Saved in browser', color: '#9ca3af' };
}

function createInitialState(): AppState {
  const demoMode = store.getDemoModeFlag();
  return createStateFromData(getStoreData(demoMode), demoMode);
}

export function useAppState(settings: AppSettings): AppViewModel {
  const [state, setState] = useState<AppState>(createInitialState);
  const stateRef = useRef(state);
  const settingsRef = useRef(settings);
  const skipNextPushRef = useRef(false);
  // Tracks which years are currently being fetched to prevent duplicate in-flight requests.
  const yearsLoadingRef = useRef<Set<number>>(new Set());
  // The Clock calendar's displayed month. `null` means "the month containing
  // today"; its own prev/next month/year controls move it independently.
  const [calendarAnchorISO, setCalendarAnchorISO] = useState<string | null>(null);
  // The day selected in the Clock calendar's side panel. `null` shows the
  // month-at-a-glance state; selecting a day (or clicking it again) toggles
  // between the day-detail and glance states.
  const [selectedClockDayISO, setSelectedClockDayISO] = useState<string | null>(null);
  // The active filter key for the Clock calendar (e.g. "project:xxx"). When set,
  // the summary stats and cell data show only entries matching this key.
  const [calendarFilterKey, setCalendarFilterKey] = useState<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const openEntry = useCallback((entry: EntryDraft, isNew: boolean) => {
    setState((current) => ({
      ...current,
      modal: {
        type: 'entry',
        isNew,
        form: {
          id: entry.id || uid(),
          kind: entry.kind,
          projectId: entry.projectId ?? '',
          serviceId: entry.serviceId ?? '',
          customerId: entry.customerId ?? '',
          amount: entry.amount != null ? String(entry.amount) : '',
          date: entry.date,
          hours: minutesToHours(entry.minutes),
          repeat: false,
          endDate: entry.date,
          skipWeekends: true,
          comment: entry.comment || '',
          attachments: entry.attachments ?? [],
        },
      },
    }));
  }, []);

  const openNewEntryForDate = useCallback((dateISO: string) => {
    const kind = stateRef.current.projects[0] ? 'project' : 'service';
    openEntry({
      kind,
      projectId: kind === 'project' ? (stateRef.current.projects[0]?.id || '') : null,
      serviceId: kind === 'service' ? (stateRef.current.services[0]?.id || '') : null,
      customerId: kind === 'service' ? (stateRef.current.customers[0]?.id || '') : null,
      date: dateISO,
      minutes: 60,
      comment: '',
    }, true);
  }, [openEntry]);

  const openNewEntry = useCallback(() => {
    openNewEntryForDate(selectedClockDayISO ?? stateRef.current.refISO);
  }, [openNewEntryForDate, selectedClockDayISO]);

  const draftFromProject = useCallback((project: Project | null, customers: Customer[], presetCustomerId?: string): ProjectForm => (
    project
      ? {
          id: project.id,
          name: project.name,
          customerId: project.customerId,
          rates: project.rates,
          newRateAmount: String(currentRatePeriod(project.rates)?.amount ?? ''),
          newRateFrom: iso(new Date()),
          budget: String(project.budget ?? ''),
          closed: project.closed ?? false,
        }
      : {
          id: null,
          name: '',
          customerId: presetCustomerId || customers[0]?.id || '',
          rates: [{ id: uid(), amount: 600, from: iso(new Date()), to: null }],
          newRateAmount: '600',
          newRateFrom: iso(new Date()),
          budget: '',
          closed: false,
        }
  ), []);

  const openProjectDetail = useCallback((project: Project | null, origin: ProjectOrigin, presetCustomerId?: string) => {
    setState((current) => ({
      ...current,
      page: 'projectDetail',
      selectedProjectId: project?.id ?? null,
      selectedServiceId: null,
      projectOrigin: origin,
      projectDraft: draftFromProject(project, current.customers, presetCustomerId),
      serviceDraft: null,
    }));
  }, [draftFromProject]);

  const draftFromService = useCallback((service: Service | null): ServiceForm => (
    service
      ? {
          id: service.id,
          name: service.name,
          rates: service.rates,
          newRateAmount: String(currentRatePeriod(service.rates)?.amount ?? ''),
          newRateFrom: iso(new Date()),
        }
      : {
          id: null,
          name: '',
          rates: [{ id: uid(), amount: 600, from: iso(new Date()), to: null }],
          newRateAmount: '600',
          newRateFrom: iso(new Date()),
        }
  ), []);

  const openServiceDetail = useCallback((service: Service | null) => {
    setState((current) => ({
      ...current,
      page: 'serviceDetail',
      selectedProjectId: null,
      selectedServiceId: service?.id ?? null,
      projectDraft: null,
      projectOrigin: null,
      serviceDraft: draftFromService(service),
    }));
  }, [draftFromService]);

  const backFromProjectDetail = useCallback(() => {
    setState((current) => {
      const origin = current.projectOrigin;
      return {
        ...current,
        page: origin?.page === 'customerDetail' ? 'customerDetail' : 'projects',
        selectedCustomerId: origin?.page === 'customerDetail' ? origin.customerId : current.selectedCustomerId,
        selectedProjectId: null,
        projectDraft: null,
        projectOrigin: null,
      };
    });
  }, []);

  const backFromServiceDetail = useCallback(() => {
    setState((current) => ({
      ...current,
      page: 'services',
      selectedServiceId: null,
      serviceDraft: null,
    }));
  }, []);

  const navCustomerDetail = useCallback((customerId: string) => {
    setState((current) => ({ ...current, page: 'customerDetail', selectedCustomerId: customerId }));
  }, []);

  const backToCustomers = useCallback(() => {
    setState((current) => ({ ...current, page: 'customers', selectedCustomerId: null }));
  }, []);

  const openCustomer = useCallback((customer: Customer | null) => {
    setState((current) => ({
      ...current,
      modal: {
        type: 'customer',
        isNew: !customer,
        form: customer
          ? { id: customer.id, name: customer.name, color: customer.color }
          : { id: null, name: '', color: PALETTE[current.customers.length % PALETTE.length] },
      },
    }));
  }, []);

  const openSettings = useCallback(() => {
    setState((current) => ({ ...current, page: 'settings' }));
  }, []);

  const closeModal = useCallback(() => {
    setState((current) => ({ ...current, modal: null }));
  }, []);

  const updateForm = useCallback((key: string, value: string | boolean) => {
    setState((current) => {
      if (!current.modal) {
        return current;
      }

      return {
        ...current,
        modal: {
          ...current.modal,
          form: {
            ...current.modal.form,
            [key]: value,
          },
        },
      };
    });
  }, []);

  const updateProjectDraft = useCallback((key: 'name' | 'customerId' | 'newRateAmount' | 'newRateFrom' | 'budget', value: string) => {
    setState((current) => {
      if (!current.projectDraft) {
        return current;
      }

      return { ...current, projectDraft: { ...current.projectDraft, [key]: value } };
    });
  }, []);

  const updateProjectDraftRates = useCallback((rates: RatePeriod[]) => {
    setState((current) => {
      if (!current.projectDraft) {
        return current;
      }

      return { ...current, projectDraft: { ...current.projectDraft, rates } };
    });
  }, []);

  const addRate = useCallback(() => {
    const draft = stateRef.current.projectDraft;
    if (!draft) {
      return;
    }

    const amount = Number.parseFloat(draft.newRateAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !draft.newRateFrom) {
      return;
    }

    const next = addRatePeriod(draft.rates, uid(), amount, draft.newRateFrom);
    if (next === draft.rates) {
      window.alert('New rate must start after the current period began.');
      return;
    }

    updateProjectDraftRates(next);
  }, [updateProjectDraftRates]);

  const updateRateField = useCallback((id: string, field: 'amount' | 'from' | 'to', value: string) => {
    const draft = stateRef.current.projectDraft;
    if (!draft) {
      return;
    }

    const next = draft.rates.map((rate) => {
      if (rate.id !== id) {
        return rate;
      }

      if (field === 'amount') {
        return { ...rate, amount: Number.parseFloat(value) || 0 };
      }
      if (field === 'from') {
        return { ...rate, from: value };
      }
      return { ...rate, to: value || null };
    });

    updateProjectDraftRates(next);
  }, [updateProjectDraftRates]);

  const deleteRate = useCallback((id: string) => {
    const draft = stateRef.current.projectDraft;
    if (!draft || draft.rates.length <= 1) {
      return;
    }

    updateProjectDraftRates(draft.rates.filter((rate) => rate.id !== id));
  }, [updateProjectDraftRates]);

  const saveProjectDraft = useCallback(() => {
    const draft = stateRef.current.projectDraft;
    if (!draft || !draft.name.trim() || draft.rates.length === 0) {
      return;
    }

    if (hasOverlap(draft.rates)) {
      window.alert('Rate periods overlap. Adjust the from/to dates before saving.');
      return;
    }

    const rates = sortRates(draft.rates);
    const parsedBudget = Number.parseFloat(draft.budget);
    const budget = Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : null;
    setState((current) => {
      const id = draft.id || uid();
      const savedProject: Project = {
        id,
        name: draft.name.trim(),
        customerId: draft.customerId,
        rates,
        budget,
        closed: draft.closed || false,
      };

      return {
        ...current,
        projects: draft.id
          ? current.projects.map((project) => (project.id === draft.id ? savedProject : project))
          : [...current.projects, savedProject],
        selectedProjectId: id,
        projectDraft: { ...draft, id, rates },
      };
    });
  }, []);

  const deleteProjectDraft = useCallback(() => {
    const draft = stateRef.current.projectDraft;
    if (!draft || !draft.id) {
      return;
    }

    const id = draft.id;
    setState((current) => ({
      ...current,
      projects: current.projects.filter((project) => project.id !== id),
      entries: current.entries.filter((entry) => entry.projectId !== id),
    }));
    backFromProjectDetail();
  }, [backFromProjectDetail]);

  const toggleProjectClosed = useCallback(() => {
    const draft = stateRef.current.projectDraft;
    if (!draft?.id) return;
    const projectId = draft.id;
    setState((current) => {
      const project = current.projects.find((p) => p.id === projectId);
      if (!project) return current;
      const newClosed = !project.closed;
      return {
        ...current,
        projects: current.projects.map((p) => (p.id === projectId ? { ...p, closed: newClosed } : p)),
        projectDraft: current.projectDraft ? { ...current.projectDraft, closed: newClosed } : current.projectDraft,
      };
    });
  }, []);

  const updateServiceDraft = useCallback((key: 'name' | 'newRateAmount' | 'newRateFrom', value: string) => {
    setState((current) => {
      if (!current.serviceDraft) {
        return current;
      }

      return { ...current, serviceDraft: { ...current.serviceDraft, [key]: value } };
    });
  }, []);

  const updateServiceDraftRates = useCallback((rates: RatePeriod[]) => {
    setState((current) => {
      if (!current.serviceDraft) {
        return current;
      }

      return { ...current, serviceDraft: { ...current.serviceDraft, rates } };
    });
  }, []);

  const addServiceRate = useCallback(() => {
    const draft = stateRef.current.serviceDraft;
    if (!draft) {
      return;
    }

    const amount = Number.parseFloat(draft.newRateAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !draft.newRateFrom) {
      return;
    }

    const next = addRatePeriod(draft.rates, uid(), amount, draft.newRateFrom);
    if (next === draft.rates) {
      window.alert('New rate must start after the current period began.');
      return;
    }

    updateServiceDraftRates(next);
  }, [updateServiceDraftRates]);

  const updateServiceRateField = useCallback((id: string, field: 'amount' | 'from' | 'to', value: string) => {
    const draft = stateRef.current.serviceDraft;
    if (!draft) {
      return;
    }

    const next = draft.rates.map((rate) => {
      if (rate.id !== id) {
        return rate;
      }

      if (field === 'amount') {
        return { ...rate, amount: Number.parseFloat(value) || 0 };
      }
      if (field === 'from') {
        return { ...rate, from: value };
      }
      return { ...rate, to: value || null };
    });

    updateServiceDraftRates(next);
  }, [updateServiceDraftRates]);

  const deleteServiceRate = useCallback((id: string) => {
    const draft = stateRef.current.serviceDraft;
    if (!draft || draft.rates.length <= 1) {
      return;
    }

    updateServiceDraftRates(draft.rates.filter((rate) => rate.id !== id));
  }, [updateServiceDraftRates]);

  const saveServiceDraft = useCallback(() => {
    const draft = stateRef.current.serviceDraft;
    if (!draft || !draft.name.trim() || draft.rates.length === 0) {
      return;
    }

    if (hasOverlap(draft.rates)) {
      window.alert('Rate periods overlap. Adjust the from/to dates before saving.');
      return;
    }

    const rates = sortRates(draft.rates);
    setState((current) => {
      const id = draft.id || uid();
      const savedService: Service = {
        id,
        name: draft.name.trim(),
        rates,
      };

      return {
        ...current,
        services: draft.id
          ? current.services.map((service) => (service.id === draft.id ? savedService : service))
          : [...current.services, savedService],
        selectedServiceId: id,
        serviceDraft: { ...draft, id, rates },
      };
    });
  }, []);

  const deleteServiceDraft = useCallback(() => {
    const draft = stateRef.current.serviceDraft;
    if (!draft || !draft.id) {
      return;
    }

    const id = draft.id;
    setState((current) => ({
      ...current,
      services: current.services.filter((service) => service.id !== id),
      entries: current.entries.filter((entry) => entry.serviceId !== id),
    }));
    backFromServiceDetail();
  }, [backFromServiceDetail]);

  const pushStateNow = useCallback(async () => {
    const current = stateRef.current;
    if (DEV_MODE || current.demoMode) {
      return;
    }

    // Split entries by year: current year goes to state.json (with config),
    // each other loaded year goes to its own state.YYYY.json blob.
    const currentYear = new Date().getFullYear();
    const entriesByYear = new Map<number, Entry[]>();
    for (const entry of current.entries) {
      const year = new Date(entry.date).getFullYear();
      if (!entriesByYear.has(year)) entriesByYear.set(year, []);
      entriesByYear.get(year)!.push(entry);
    }

    const currentYearEntries = entriesByYear.get(currentYear) ?? [];
    const data: PersistedData = {
      customers: current.customers,
      projects: current.projects,
      services: current.services,
      entries: currentYearEntries,
    };

    setState((snapshot) => ({ ...snapshot, syncStatus: 'syncing' }));

    try {
      const result = await store.saveState(data, stateRef.current.stateEtag);
      const newYearEtags = { ...stateRef.current.yearEtags };

      // Save all loaded past years whose entries are in memory.
      for (const [year, entries] of entriesByYear) {
        if (year === currentYear) continue;
        if (!stateRef.current.loadedYears.includes(year)) continue;
        try {
          const yearResult = await store.saveEntriesYear(year, entries, stateRef.current.yearEtags[year] ?? '');
          newYearEtags[year] = yearResult.etag;
        } catch (yearError) {
          if (yearError instanceof store.ConflictError) {
            // Another tab wrote this year blob — reload to get the new ETag.
            try {
              const remote = await store.fetchEntriesYear(year);
              newYearEtags[year] = remote.etag;
            } catch {
              // Non-fatal: the year blob will be retried on the next push.
            }
          }
          // Continue saving other years even if one fails.
        }
      }

      setState((snapshot) => ({ ...snapshot, stateEtag: result.etag, yearEtags: newYearEtags, syncStatus: 'synced' }));
    } catch (error) {
      if (error instanceof store.ConflictError) {
        try {
          const remote = await store.fetchState();
          const currentYear2 = new Date().getFullYear();
          setState((snapshot) => ({
            ...snapshot,
            customers: remote.data.customers,
            projects: remote.data.projects,
            services: remote.data.services,
            // Current year entries come from remote; past years stay as-is.
            entries: [
              ...remote.data.entries,
              ...snapshot.entries.filter((e) => new Date(e.date).getFullYear() !== currentYear2),
            ],
            stateEtag: remote.etag,
            loadedYears: snapshot.loadedYears,
            syncStatus: 'conflict',
          }));
        } catch {
          setState((snapshot) => ({ ...snapshot, syncStatus: 'error' }));
        }
        return;
      }

      setState((snapshot) => ({ ...snapshot, syncStatus: 'error' }));
    }
  }, []);

  const pullStateNow = useCallback(async () => {
    if (DEV_MODE || stateRef.current.demoMode) {
      return;
    }

    setState((snapshot) => ({ ...snapshot, syncStatus: 'syncing' }));
    const currentYear = new Date().getFullYear();

    try {
      const remote = await store.fetchState();
      setState((snapshot) => ({
        ...snapshot,
        customers: remote.data.customers,
        projects: remote.data.projects,
        services: remote.data.services,
        // Remote returns current year entries only; discard any previously loaded past years
        // so the user starts fresh. They'll be re-fetched lazily when navigated to.
        entries: remote.data.entries,
        stateEtag: remote.etag,
        loadedYears: [currentYear],
        yearEtags: {},
        syncStatus: 'synced',
      }));
    } catch {
      setState((snapshot) => ({ ...snapshot, syncStatus: 'error' }));
    }
  }, []);

  const pullYearNow = useCallback(async (year: number) => {
    if (DEV_MODE || stateRef.current.demoMode) {
      return;
    }
    if (stateRef.current.loadedYears.includes(year)) {
      return;
    }
    if (yearsLoadingRef.current.has(year)) {
      return;
    }

    yearsLoadingRef.current.add(year);
    try {
      const remote = await store.fetchEntriesYear(year);
      setState((current) => {
        if (current.loadedYears.includes(year)) {
          return current; // Loaded by another concurrent call
        }
        return {
          ...current,
          entries: [...current.entries, ...remote.entries],
          loadedYears: [...current.loadedYears, year],
          yearEtags: { ...current.yearEtags, [year]: remote.etag },
        };
      });
    } finally {
      yearsLoadingRef.current.delete(year);
    }
  }, []);

  const onAddAttachments = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    const modal = stateRef.current.modal;
    if (!files || files.length === 0 || !modal || modal.type !== 'entry') {
      return;
    }

    const entryId = (modal.form as EntryForm).id;
    if (!entryId) {
      return;
    }

    setState((current) => ({ ...current, attachmentUploading: true, attachmentError: '' }));

    try {
      for (const file of Array.from(files)) {
        const attachment = await store.uploadAttachment(entryId, file);
        setState((current) => {
          if (!current.modal || current.modal.type !== 'entry') {
            return current;
          }
          const form = current.modal.form as EntryForm;
          return {
            ...current,
            modal: { ...current.modal, form: { ...form, attachments: [...form.attachments, attachment] } },
          };
        });
      }
      setState((current) => ({ ...current, attachmentUploading: false }));
    } catch {
      setState((current) => ({ ...current, attachmentUploading: false, attachmentError: 'Failed to upload one or more files.' }));
    } finally {
      event.target.value = '';
    }
  }, []);

  const onDeleteAttachment = useCallback((attachmentId: string) => {
    const modal = stateRef.current.modal;
    if (!modal || modal.type !== 'entry') {
      return;
    }

    const entryId = (modal.form as EntryForm).id;
    if (!entryId) {
      return;
    }

    void store.deleteAttachment(entryId, attachmentId);
    setState((current) => {
      if (!current.modal || current.modal.type !== 'entry') {
        return current;
      }
      const form = current.modal.form as EntryForm;
      return {
        ...current,
        modal: { ...current.modal, form: { ...form, attachments: form.attachments.filter((item) => item.id !== attachmentId) } },
      };
    });
  }, []);

  const onDownloadAttachment = useCallback(async (entryId: string, attachmentId: string) => {
    try {
      const url = await store.getAttachmentDownloadUrl(entryId, attachmentId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setState((current) => ({ ...current, attachmentError: 'Failed to open attachment.' }));
    }
  }, []);

  const signIn = useCallback(() => {
    window.location.href = '/.auth/login/github';
  }, []);

  const signOut = useCallback(() => {
    window.location.href = '/.auth/logout?post_logout_redirect_uri=/';
  }, []);

  const saveModal = useCallback(() => {
    const modal = stateRef.current.modal;
    if (!modal) {
      return;
    }

    if (modal.type === 'entry') {
      const form = modal.form as EntryForm;
      const minutes = hoursToMinutes(form.hours);
      const invalidProject = form.kind === 'project' && !form.projectId;
      const invalidService = form.kind === 'service' && (!form.serviceId || !form.customerId);
      const parsedAmount = Number(form.amount);
      const invalidCustomer = form.kind === 'customer' && (!form.customerId || !Number.isFinite(parsedAmount) || parsedAmount <= 0);
      if (invalidProject || invalidService || invalidCustomer || !Number.isFinite(minutes) || minutes <= 0) {
        return;
      }

      // Budget cap enforcement: block new project entries that would meet or exceed the remaining budget.
      if (modal.isNew && form.kind === 'project' && form.projectId) {
        const hpdNow = getHoursPerDay(settingsRef.current);
        const project = stateRef.current.projects.find((p) => p.id === form.projectId);
        if (project && (project.budget ?? 0) > 0) {
          const budget = project.budget!;
          const spent = stateRef.current.entries
            .filter((e) => e.kind === 'project' && e.projectId === form.projectId)
            .reduce((sum, e) => sum + ((e.minutes / 60) / hpdNow) * rateForDate(project.rates, e.date), 0);
          const remaining = budget - spent;

          if (remaining <= 0) {
            window.alert(`Budget cap of ${fmtEUR(budget)} reached for "${project.name}". No new entries can be added to this project.`);
            return;
          }

          // Compute total earnings this submission would add (handles single and repeat).
          let totalNewEarn = 0;
          if (form.repeat) {
            const startDate = parseISO(form.date);
            const endDate = parseISO(form.endDate);
            for (let cursor = new Date(startDate); cursor <= endDate; cursor = addDays(cursor, 1)) {
              if (form.skipWeekends && isWeekend(cursor)) continue;
              totalNewEarn += (minutes / 60 / hpdNow) * rateForDate(project.rates, iso(cursor));
            }
          } else {
            totalNewEarn = (minutes / 60 / hpdNow) * rateForDate(project.rates, form.date);
          }

          if (totalNewEarn > remaining) {
            const rate = rateForDate(project.rates, form.date);
            const maxHours = rate > 0 ? (remaining / rate) * hpdNow : 0;
            window.alert(
              `This entry (${fmtEUR(Math.round(totalNewEarn))}) would exceed the remaining budget of ${fmtEUR(Math.round(remaining))} for "${project.name}". ` +
              `Max you can book: ${fmtH(Math.round(maxHours * 60))}.`,
            );
            return;
          }
        }
      }

      const buildEntry = (id: string, date: string, attachments: EntryForm['attachments']): Entry => ({        id,
        kind: form.kind,
        projectId: form.kind === 'project' ? form.projectId : null,
        serviceId: form.kind === 'service' ? form.serviceId : null,
        customerId: form.kind === 'service' || form.kind === 'customer' ? form.customerId : null,
        amount: form.kind === 'customer' ? parsedAmount : null,
        date,
        minutes,
        comment: form.comment,
        attachments,
      });

      if (modal.isNew && form.repeat) {
        const startDate = parseISO(form.date);
        const endDate = parseISO(form.endDate);
        if (endDate < startDate) {
          return;
        }
        const newEntries: Entry[] = [];
        for (let cursor = new Date(startDate); cursor <= endDate; cursor = addDays(cursor, 1)) {
          if (form.skipWeekends && isWeekend(cursor)) {
            continue;
          }
          newEntries.push(buildEntry(uid(), iso(cursor), []));
        }
        if (newEntries.length === 0) {
          return;
        }
        setState((current) => ({
          ...current,
          entries: [...current.entries, ...newEntries],
          modal: null,
        }));
        return;
      }

      const id = form.id ?? uid();
      const savedEntry = buildEntry(id, form.date, form.attachments);
      setState((current) => ({
        ...current,
        entries: current.entries.some((entry) => entry.id === id)
            ? current.entries.map((entry) => (
                entry.id === id ? savedEntry : entry
              ))
            : [
              ...current.entries,
              savedEntry,
            ],
        modal: null,
      }));
      return;
    }

    if (modal.type === 'customer') {
      const form = modal.form as CustomerForm;
      if (!form.name.trim()) {
        return;
      }

      setState((current) => ({
        ...current,
        customers: form.id
          ? current.customers.map((customer) => (
              customer.id === form.id ? { ...customer, name: form.name.trim() } : customer
            ))
          : [...current.customers, { id: uid(), name: form.name.trim(), color: form.color }],
        modal: null,
      }));
      return;
    }

  }, []);

  const deleteCustomerById = useCallback((id: string) => {
    setState((current) => {
      const projectIds = current.projects.filter((project) => project.customerId === id).map((project) => project.id);
      return {
        ...current,
        customers: current.customers.filter((customer) => customer.id !== id),
        projects: current.projects.filter((project) => project.customerId !== id),
        entries: current.entries.filter((entry) => !projectIds.includes(entry.projectId ?? '') && entry.customerId !== id),
        page: 'customers',
        selectedCustomerId: null,
      };
    });
  }, []);

  const deleteModal = useCallback(() => {
    const modal = stateRef.current.modal;
    if (!modal || modal.isNew) {
      return;
    }

    if (modal.type === 'entry') {
      const id = (modal.form as EntryForm).id;
      if (!id) {
        return;
      }

      const attachments = (modal.form as EntryForm).attachments;
      attachments.forEach((attachment) => {
        void store.deleteAttachment(id, attachment.id);
      });

      setState((current) => ({
        ...current,
        entries: current.entries.filter((entry) => entry.id !== id),
        modal: null,
      }));
      return;
    }

    const id = (modal.form as CustomerForm).id;
    if (!id) {
      return;
    }

    setState((current) => {
      const projectIds = current.projects.filter((project) => project.customerId === id).map((project) => project.id);
      return {
        ...current,
        customers: current.customers.filter((customer) => customer.id !== id),
        projects: current.projects.filter((project) => project.customerId !== id),
        entries: current.entries.filter((entry) => !projectIds.includes(entry.projectId ?? '') && entry.customerId !== id),
        modal: null,
      };
    });
  }, []);

  const resetData = useCallback(() => {
    if (!window.confirm('Delete all data? This cannot be undone.')) {
      return;
    }

    const currentYear = new Date().getFullYear();
    skipNextPushRef.current = true;
    setState((current) => {
      if (current.demoMode) {
        store.clearDemoData();
        const demoData = createDemoSeed();
        store.saveDemoData(demoData);
        return {
          ...current,
          customers: demoData.customers,
          projects: demoData.projects,
          services: demoData.services,
          entries: demoData.entries,
          page: 'clock',
          modal: null,
          syncStatus: 'idle',
          loadedYears: [currentYear],
          yearEtags: {},
          selectedCustomerId: null,
          selectedProjectId: null,
          selectedServiceId: null,
          projectDraft: null,
          projectOrigin: null,
          serviceDraft: null,
          exportScope: null,
          earningsFilter: null,
        };
      }

      store.clearData();
      const emptyData = createEmptyData();
      return {
        ...current,
        customers: emptyData.customers,
        projects: emptyData.projects,
        services: emptyData.services,
        entries: emptyData.entries,
        page: 'clock',
        modal: null,
        syncStatus: 'idle',
        loadedYears: [currentYear],
        yearEtags: {},
        selectedCustomerId: null,
        selectedProjectId: null,
        selectedServiceId: null,
        projectDraft: null,
        projectOrigin: null,
        serviceDraft: null,
        exportScope: null,
        earningsFilter: null,
      };
    });
  }, []);

  const onToggleDemoMode = useCallback(() => {
    setState((current) => {
      const nextDemoMode = !current.demoMode;
      const data = getStoreData(nextDemoMode);
      store.setDemoModeFlag(nextDemoMode);
      const currentYear = new Date().getFullYear();

      return {
        ...current,
        customers: data.customers,
        projects: data.projects,
        services: data.services,
        entries: data.entries,
        demoMode: nextDemoMode,
        modal: null,
        syncStatus: 'idle',
        loadedYears: [currentYear],
        yearEtags: {},
        selectedCustomerId: null,
        selectedProjectId: null,
        selectedServiceId: null,
        projectDraft: null,
        projectOrigin: null,
        serviceDraft: null,
      };
    });
  }, []);

  const setPage = useCallback((page: Page) => {
    setState((current) => ({
      ...current,
      page,
      selectedCustomerId: null,
      selectedProjectId: null,
      selectedServiceId: null,
      projectDraft: null,
      projectOrigin: null,
      serviceDraft: null,
      exportScope: null,
      earningsFilter: null,
    }));
  }, []);

  const openExport = useCallback((scope: ExportScope | null) => {
    setState((current) => ({ ...current, page: 'export', exportScope: scope }));
  }, []);

  const openEarnings = useCallback((seed: EarningsFilterSeed | null) => {
    setState((current) => ({ ...current, page: 'earnings', earningsFilter: seed }));
  }, []);

  const shiftCalendarAnchor = useCallback((months: number) => {
    setCalendarAnchorISO((current) => {
      const base = current ? parseISO(current) : parseISO(stateRef.current.refISO);
      return iso(addMonths(base, months));
    });
    setSelectedClockDayISO(null);
  }, []);

  const onCalendarPrevMonth = useCallback(() => shiftCalendarAnchor(-1), [shiftCalendarAnchor]);
  const onCalendarNextMonth = useCallback(() => shiftCalendarAnchor(1), [shiftCalendarAnchor]);
  const onCalendarToday = useCallback(() => {
    setCalendarAnchorISO(null);
    setSelectedClockDayISO(null);
  }, []);
  const onSetCalendarFilter = useCallback((key: string) => {
    setCalendarFilterKey((prev) => (prev === key ? null : key));
  }, []);
  const onClearCalendarFilter = useCallback(() => setCalendarFilterKey(null), []);
  const onSelectClockDay = useCallback((dayISO: string) => {
    setSelectedClockDayISO((current) => (current === dayISO ? null : dayISO));
  }, []);

  useEffect(() => {
    // Cache to localStorage, filtering entries to current year only so the cache
    // stays lean. Past-year entries are re-fetched lazily from the remote on demand.
    const currentYear = new Date().getFullYear();
    const currentYearEntries = state.entries.filter((e) => new Date(e.date).getFullYear() === currentYear);
    const data = {
      customers: state.customers,
      projects: state.projects,
      services: state.services,
      entries: currentYearEntries,
    };

    if (state.demoMode) {
      store.saveDemoData(data);
      return;
    }

    store.saveData(data);
  }, [state.customers, state.demoMode, state.entries, state.projects, state.services]);

  // Lazy-load past years when the calendar navigates to a year not yet in memory.
  useEffect(() => {
    if (!calendarAnchorISO || DEV_MODE || stateRef.current.demoMode) return;
    const year = parseISO(calendarAnchorISO).getFullYear();
    void pullYearNow(year);
  }, [calendarAnchorISO, pullYearNow]);

  // Fetch the current user's identity once on mount. When unauthenticated
  // (no clientPrincipal with the owner role) the app falls back to demo mode
  // automatically so visitors can explore the app without signing in.
  useEffect(() => {
    fetch('/.auth/me')
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { clientPrincipal?: { userDetails?: string; userRoles?: string[] } | null } | null) => {
        const principal = body?.clientPrincipal;
        const isOwner = principal?.userRoles?.includes('owner') ?? false;

        if (!isOwner) {
          setState((current) => {
            const nextDemoMode = true;
            const data = getStoreData(nextDemoMode);
            store.setDemoModeFlag(nextDemoMode);
            const currentYear = new Date().getFullYear();
            return {
              ...current,
              isAuthenticated: false,
              demoMode: nextDemoMode,
              customers: data.customers,
              projects: data.projects,
              services: data.services,
              entries: data.entries,
              syncStatus: 'idle',
              loadedYears: [currentYear],
              yearEtags: {},
            };
          });
          return;
        }

        setState((current) => {
          // If the user just signed in while demo mode was active (e.g. they
          // browsed as a guest and then authenticated), exit demo mode now so
          // real data syncs immediately.
          if (current.demoMode) {
            store.setDemoModeFlag(false);
            const realData = store.loadData() || createEmptyData();
            const currentYear = new Date().getFullYear();
            return {
              ...current,
              isAuthenticated: true,
              userDisplayName: principal?.userDetails ?? '',
              demoMode: false,
              customers: realData.customers,
              projects: realData.projects,
              services: realData.services,
              entries: realData.entries.filter((e) => new Date(e.date).getFullYear() === currentYear),
              syncStatus: 'idle',
              loadedYears: [currentYear],
              yearEtags: {},
            };
          }

          return {
            ...current,
            isAuthenticated: true,
            userDisplayName: principal?.userDetails ?? '',
          };
        });
      })
      .catch(() => {
        // No auth proxy in local dev; ignore.
      });
  }, []);

  useEffect(() => {
    if (!DEV_MODE && !state.demoMode) {
      void pullStateNow();
    }
  }, [state.demoMode, pullStateNow]);

  useEffect(() => {
    if (DEV_MODE || state.demoMode) {
      return undefined;
    }

    if (skipNextPushRef.current) {
      skipNextPushRef.current = false;
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void pushStateNow();
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [state.customers, state.demoMode, state.entries, state.projects, state.services, pushStateNow]);

  const hpd = getHoursPerDay(settings);
  const ref = parseISO(state.refISO);
  const todayISO = iso(new Date());

  const projById = useMemo<Record<string, Project>>(() => {
    const next: Record<string, Project> = {};
    state.projects.forEach((project) => {
      next[project.id] = project;
    });
    return next;
  }, [state.projects]);

  const serviceById = useMemo<Record<string, Service>>(() => {
    const next: Record<string, Service> = {};
    state.services.forEach((service) => {
      next[service.id] = service;
    });
    return next;
  }, [state.services]);

  const custById = useMemo<Record<string, Customer>>(() => {
    const next: Record<string, Customer> = {};
    state.customers.forEach((customer) => {
      next[customer.id] = customer;
    });
    return next;
  }, [state.customers]);

  const entryEarn = useCallback((entry: Entry) => {
    if (entry.kind === 'customer') {
      return entry.amount ?? 0;
    }
    if (entry.kind === 'service') {
      const service = serviceById[entry.serviceId ?? ''];
      return service ? rateForDate(service.rates, entry.date) : 0;
    }
    const project = projById[entry.projectId ?? ''];
    return project ? (((entry.minutes) / 60) / hpd) * rateForDate(project.rates, entry.date) : 0;
  }, [hpd, projById, serviceById]);

  const ctx: RenderCtx = useMemo(() => {
    const isCustomerDetail = state.page === 'customerDetail';
    const isProjectDetail = state.page === 'projectDetail';
    const isServiceDetail = state.page === 'serviceDetail';
    const navSection: RenderCtx['navSection'] = isCustomerDetail
      ? 'customers'
      : isProjectDetail
        ? (state.projectOrigin?.page === 'customerDetail' ? 'customers' : 'projects')
        : isServiceDetail
          ? 'services'
          : (state.page === 'projects' || state.page === 'services' || state.page === 'customers' || state.page === 'settings' || state.page === 'export' || state.page === 'earnings' ? state.page : 'clock');

    return {
      S: state,
      acc: (settings.accentColor === '#2563eb' ? undefined : settings.accentColor) || '#1e3a5f',
      hpd,
      showWeekend: settings.showWeekend,
      ref,
      todayISO,
      projById,
      serviceById,
      custById,
      entryEarn,
      isClock: state.page === 'clock',
      isProjects: state.page === 'projects',
      isServices: state.page === 'services',
      isCustomers: state.page === 'customers',
      isSettings: state.page === 'settings',
      isCustomerDetail,
      isProjectDetail,
      isServiceDetail,
      isExport: state.page === 'export',
      isEarnings: state.page === 'earnings',
      navSection,
      calendarAnchor: calendarAnchorISO ? parseISO(calendarAnchorISO) : ref,
      selectedClockDayISO,
      calendarFilterKey,
    };
  }, [state, settings, hpd, ref, todayISO, projById, serviceById, custById, entryEarn, calendarAnchorISO, selectedClockDayISO, calendarFilterKey]);

  const sidebarProps = useMemo<SidebarProps>(() => {
    const periodLabel = 'This month';
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();
    const periodEntries = ctx.S.entries.filter((entry) => {
      const d = parseISO(entry.date);
      return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
    });

    const periodMinutes = periodEntries.reduce((sum, entry) => sum + entry.minutes, 0);
    const periodEarn = periodEntries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);

    const { label: syncLabel, color: syncColor } = getSyncStatusMeta(ctx.S.demoMode, ctx.S.syncStatus);

    return {
      logoStyle: {
        width: '28px',
        height: '28px',
        borderRadius: '8px',
        background: `linear-gradient(135deg, ${ctx.acc}, color-mix(in srgb, ${ctx.acc} 60%, #2563eb))`,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        fontSize: '15px',
        flexShrink: 0,
        boxShadow: `0 1px 4px color-mix(in srgb, ${ctx.acc} 50%, transparent)`,
      },
      navClockStyle: navStyle(ctx.navSection === 'clock', ctx.acc),
      navProjectsStyle: navStyle(ctx.navSection === 'projects', ctx.acc),
      navServicesStyle: navStyle(ctx.navSection === 'services', ctx.acc),
      navCustomersStyle: navStyle(ctx.navSection === 'customers', ctx.acc),
      navExportStyle: navStyle(ctx.navSection === 'export', ctx.acc),
      navEarningsStyle: navStyle(ctx.navSection === 'earnings', ctx.acc),
      onNavClock: () => setPage('clock'),
      onNavProjects: () => setPage('projects'),
      onNavServices: () => setPage('services'),
      onNavCustomers: () => setPage('customers'),
      onNavExport: () => openExport(null),
      onNavEarnings: () => openEarnings(null),
      periodLabel,
      monthHours: fmtH(periodMinutes),
      monthDaysStr: (periodMinutes / 60 / ctx.hpd).toFixed(1),
      monthEarnStr: fmtEUR(periodEarn),
      syncColor,
      syncLabel,
      syncStatus: ctx.S.syncStatus,
      onOpenSettings: openSettings,
      accent: ctx.acc,
      isAuthenticated: ctx.S.isAuthenticated,
      onSignIn: signIn,
    };
  }, [ctx, openEarnings, openExport, openSettings, setPage, signIn]);

  const headerProps = useMemo<AppHeaderProps>(() => {
    const monthRef = ctx.calendarAnchor;
    const monthIndex = monthRef.getMonth();
    const monthYear = monthRef.getFullYear();
    const today = new Date();
    const diffMonths = (monthYear - today.getFullYear()) * 12 + (monthIndex - today.getMonth());

    const relMonth = diffMonths === 0
      ? 'This month'
      : diffMonths === -1
        ? 'Last month'
        : diffMonths === 1
          ? 'Next month'
          : diffMonths < 0
            ? `${Math.abs(diffMonths)} months ago`
            : `${diffMonths} months from now`;

    const monthEntries = ctx.S.entries.filter((entry) => {
      const date = parseISO(entry.date);
      return date.getFullYear() === monthYear && date.getMonth() === monthIndex;
    });
    const monthMinutes = monthEntries.reduce((sum, entry) => sum + entry.minutes, 0);
    const monthEarn = monthEntries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);

    let headerTitle = 'Today';
    let headerSubtitle = '';
    if (ctx.isClock) {
      headerTitle = fmtMonthYear(monthRef);
      headerSubtitle = `${relMonth}${monthMinutes > 0 ? ` · ${fmtH(monthMinutes)} · ${fmtEUR(monthEarn)}` : ''}`;
    } else if (ctx.isProjects) {
      headerTitle = 'Projects';
      headerSubtitle = `${ctx.S.projects.length} active`;
    } else if (ctx.isServices) {
      headerTitle = 'Services';
      headerSubtitle = `${ctx.S.services.length} active`;
    } else if (ctx.isSettings) {
      headerTitle = 'Settings';
      headerSubtitle = 'Demo mode, Azure sync and data controls';
    } else if (ctx.isCustomers) {
      headerTitle = 'Customers';
      headerSubtitle = `${ctx.S.customers.length} total`;
    } else if (ctx.isCustomerDetail) {
      const customer = ctx.S.selectedCustomerId ? ctx.custById[ctx.S.selectedCustomerId] : undefined;
      const projectCount = ctx.S.projects.filter((project) => project.customerId === ctx.S.selectedCustomerId).length;
      headerTitle = customer?.name || 'Customer';
      headerSubtitle = `${projectCount}${projectCount === 1 ? ' project' : ' projects'}`;
    } else if (ctx.isProjectDetail) {
      const draft = ctx.S.projectDraft;
      headerTitle = draft?.name || 'New project';
      headerSubtitle = draft ? (ctx.custById[draft.customerId]?.name || '—') : '';
    } else if (ctx.isServiceDetail) {
      const draft = ctx.S.serviceDraft;
      headerTitle = draft?.name || 'New service';
      headerSubtitle = 'Recurring fixed-rate work';
    } else if (ctx.isExport) {
      headerTitle = 'Export timesheet';
      headerSubtitle = 'PDF + attachments for a customer or project';
    } else if (ctx.isEarnings) {
      headerTitle = 'Earnings';
      headerSubtitle = 'Totals and breakdown by customer or project';
    }

    return {
      headerTitle,
      headerSubtitle,
      isClock: ctx.isClock,
      isProjects: ctx.isProjects,
      isServices: ctx.isServices,
      isCustomers: ctx.isCustomers,
      onPrev: onCalendarPrevMonth,
      onToday: onCalendarToday,
      onNext: onCalendarNextMonth,
      btnPrimary: {
        height: '44px',
        padding: '0 16px',
        border: 'none',
        background: `linear-gradient(135deg, ${ctx.acc}, color-mix(in srgb, ${ctx.acc} 72%, #2563eb))`,
        color: '#fff',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13.5px',
        fontWeight: 600,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
      },
      onNewEntry: openNewEntry,
      onNewProject: () => openProjectDetail(null, { page: 'projects' }),
      onNewService: () => openServiceDetail(null),
      onNewCustomer: () => openCustomer(null),
    };
  }, [ctx, onCalendarNextMonth, onCalendarPrevMonth, onCalendarToday, openCustomer, openNewEntry, openProjectDetail, openServiceDetail]);

  const settingsProps = useMemo<SettingsViewProps | null>(() => {
    if (!ctx.isSettings) {
      return null;
    }

    const { label: syncStatusLabel, color: syncStatusColor } = getSyncStatusMeta(ctx.S.demoMode, ctx.S.syncStatus);

    const demoModeHint = ctx.S.isAuthenticated
      ? 'Preview Punch with example projects, customers and time entries. Your real data stays untouched and you can switch back anytime.'
      : 'You\'re browsing as a guest. Sign in with GitHub to save your data and sync it across devices.';

    return {
      onBack: () => setPage('clock'),
      demoMode: ctx.S.demoMode,
      onToggleDemoMode,
      demoModeHint,
      syncDisabled: DEV_MODE || ctx.S.demoMode,
      syncStatusLabel,
      syncStatusColor,
      onSyncNow: () => {
        void pushStateNow();
      },
      signedInAs: ctx.S.userDisplayName,
      onSignOut: signOut,
      isAuthenticated: ctx.S.isAuthenticated,
      onSignIn: signIn,
      onDeleteAll: resetData,
    };
  }, [ctx, onToggleDemoMode, pushStateNow, resetData, setPage, signIn, signOut]);

  const clockProps = useMemo<ClockViewProps | null>(() => {
    if (!ctx.isClock) {
      return null;
    }

    const dowLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const monthRef = ctx.calendarAnchor;
    const monthIndex = monthRef.getMonth();
    const monthYear = monthRef.getFullYear();
    const gridStart = startOfWeek(new Date(monthYear, monthIndex, 1, 12));

    // Returns the grouping key for an entry — used both for the filter and the pips.
    const entryKey = (entry: Entry) =>
      entry.kind === 'project'
        ? `project:${entry.projectId}`
        : entry.kind === 'service'
          ? `service:${entry.serviceId}:${entry.customerId}`
          : `customer:${entry.customerId}`;

    const filterKey = ctx.calendarFilterKey;
    const matchesFilter = (entry: Entry) => !filterKey || entryKey(entry) === filterKey;

    const entriesByDate = new Map<string, Entry[]>();
    for (const entry of ctx.S.entries) {
      const list = entriesByDate.get(entry.date);
      if (list) {
        list.push(entry);
      } else {
        entriesByDate.set(entry.date, [entry]);
      }
    }

    const monthEntries = ctx.S.entries.filter((entry) => {
      const date = parseISO(entry.date);
      return date.getFullYear() === monthYear && date.getMonth() === monthIndex;
    });
    // When a filter is active, summary stats only count matching entries.
    const summaryEntries = filterKey ? monthEntries.filter(matchesFilter) : monthEntries;
    const monthMinutes = summaryEntries.reduce((sum, entry) => sum + entry.minutes, 0);
    const monthEarn = summaryEntries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);
    const shadeCap = ctx.hpd > 0 ? ctx.hpd * 1.25 : 1;

    // Month grid: 6 fixed rows so the layout never reflows month to month.
    const weeks: ClockWeekRowVM[] = [];
    for (let week = 0; week < 6; week += 1) {
      const days: ClockMonthDayVM[] = [];
      let weekMinutes = 0;
      let weekendMinutes = 0;
      for (let day = 0; day < 7; day += 1) {
        const date = addDays(gridStart, week * 7 + day);
        const cellISO = iso(date);
        const isCurrentMonth = date.getMonth() === monthIndex;
        const isToday = cellISO === ctx.todayISO;
        const allCellEntries = entriesByDate.get(cellISO) ?? [];
        // When a filter is active, cell data only reflects matching entries.
        const cellEntries = filterKey ? allCellEntries.filter(matchesFilter) : allCellEntries;
        const cellMinutes = cellEntries.reduce((sum, entry) => sum + entry.minutes, 0);
        const cellEarn = cellEntries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);
        weekMinutes += cellMinutes;
        if (day >= 5) weekendMinutes += cellMinutes;

        const pipColors: string[] = [];
        const seenPipKeys = new Set<string>();
        for (const entry of cellEntries) {
          const pipKey = entryKey(entry);
          if (seenPipKeys.has(pipKey)) {
            continue;
          }
          seenPipKeys.add(pipKey);
          pipColors.push(colorForEntry(entry, ctx.projById, ctx.custById));
          if (pipColors.length >= 4) {
            break;
          }
        }

        days.push({
          iso: cellISO,
          dayNum: date.getDate(),
          isToday,
          isCurrentMonth,
          isWeekend: day >= 5,
          isSelected: ctx.selectedClockDayISO === cellISO,
          hasData: cellMinutes > 0,
          hoursLabel: cellMinutes > 0 ? fmtH(cellMinutes) : '',
          earnLabel: cellMinutes / 60 >= shadeCap * 0.6 && cellEarn > 0 ? fmtEUR(cellEarn) : '',
          pips: pipColors,
          title: cellMinutes > 0 ? `${cellISO} · ${fmtH(cellMinutes)}` : cellISO,
          onClick: () => onSelectClockDay(cellISO),
        });
      }
      weeks.push({
        weekLabel: `W${isoWeekNumber(addDays(gridStart, week * 7))}`,
        hoursLabel: weekMinutes > 0 ? fmtH(weekMinutes) : '',
        hasWeekendData: weekendMinutes > 0,
        days,
      });
    }

    // Side panel: day detail when a day is selected, otherwise a month
    // at-a-glance summary (entries + weekly breakdown).
    let panel: ClockDayPanelVM | ClockMonthGlanceVM;
    const selectedISO = ctx.selectedClockDayISO;
    const allSelectedEntries = selectedISO ? (entriesByDate.get(selectedISO) ?? []) : [];
    const selectedEntries = filterKey ? allSelectedEntries.filter(matchesFilter) : allSelectedEntries;
    if (selectedISO && (selectedEntries.length > 0 || parseISO(selectedISO).getMonth() === monthIndex)) {
      const selectedDate = parseISO(selectedISO);
      const dayMinutes = selectedEntries.reduce((sum, entry) => sum + entry.minutes, 0);
      const dayEarn = selectedEntries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);
      const entryRows: ClockDayEntryVM[] = selectedEntries
        .slice()
        .sort((a, b) => b.minutes - a.minutes)
        .map((entry) => {
          const customerName = ctx.custById[entry.customerId ?? '']?.name || '—';
          return {
            id: entry.id,
            name: entry.kind === 'project'
              ? (ctx.projById[entry.projectId ?? '']?.name || '—')
              : entry.kind === 'service'
                ? (ctx.serviceById[entry.serviceId ?? '']?.name || '—')
                : customerName,
            subLabel: entry.kind === 'project'
              ? (ctx.custById[ctx.projById[entry.projectId ?? '']?.customerId ?? '']?.name || '—')
              : entry.kind === 'service'
                ? customerName
                : 'Flat fee',
            dotColor: colorForEntry(entry, ctx.projById, ctx.custById),
            hoursLabel: entry.kind === 'customer' ? '' : fmtH(entry.minutes),
            earnLabel: ctx.entryEarn(entry) > 0 ? fmtEUR(ctx.entryEarn(entry)) : '',
            onClick: () => openEntry(entry, false),
          };
        });

      panel = {
        mode: 'day',
        iso: selectedISO,
        dateLabel: fmtFullDate(selectedDate),
        hoursLabel: dayMinutes > 0 ? fmtH(dayMinutes) : '',
        earnLabel: dayEarn > 0 ? fmtEUR(dayEarn) : '',
        entries: entryRows,
        onAddEntry: () => openNewEntryForDate(selectedISO),
        onBack: () => onSelectClockDay(selectedISO),
      };
    } else {
      type ProjectSeed = {
        key: string;
        name: string;
        subLabel: string;
        dotColor: string;
        minutes: number;
        earn: number;
      };
      const projectSeeds = new Map<string, ProjectSeed>();
      for (const entry of monthEntries) {
        const key = entryKey(entry);
        const customerName = ctx.custById[entry.customerId ?? '']?.name || '—';
        const seed = projectSeeds.get(key) ?? {
          key,
          name: entry.kind === 'project'
            ? (ctx.projById[entry.projectId ?? '']?.name || '—')
            : entry.kind === 'service'
              ? (ctx.serviceById[entry.serviceId ?? '']?.name || '—')
              : customerName,
          subLabel: entry.kind === 'project'
            ? (ctx.custById[ctx.projById[entry.projectId ?? '']?.customerId ?? '']?.name || '—')
            : entry.kind === 'service'
              ? customerName
              : 'Flat fee',
          dotColor: colorForEntry(entry, ctx.projById, ctx.custById),
          minutes: 0,
          earn: 0,
        };
        seed.minutes += entry.minutes;
        seed.earn += ctx.entryEarn(entry);
        projectSeeds.set(key, seed);
      }
      const rankedProjects = [...projectSeeds.values()].sort((a, b) => b.minutes - a.minutes);
      const topMinutes = rankedProjects[0]?.minutes || 1;
      const topProjects: ClockMonthGlanceProjectVM[] = rankedProjects.slice(0, 5).map((seed) => ({
        key: seed.key,
        name: seed.name,
        subLabel: seed.subLabel,
        dotColor: seed.dotColor,
        hoursLabel: seed.minutes > ctx.hpd * 60 ? fmtDays(seed.minutes, ctx.hpd) : fmtH(seed.minutes),
        earnLabel: seed.earn > 0 ? fmtEUR(seed.earn) : '',
        barPct: Math.round((seed.minutes / topMinutes) * 100),
        isFiltered: filterKey === seed.key,
        onFilter: () => onSetCalendarFilter(seed.key),
      }));

      const filterLabel = filterKey
        ? (rankedProjects.find((p) => p.key === filterKey)?.name ?? null)
        : null;

      panel = {
        mode: 'glance',
        topProjects,
        filterLabel,
        onClearFilter: onClearCalendarFilter,
        onAddEntry: () => openNewEntryForDate(
          monthIndex === new Date().getMonth() && monthYear === new Date().getFullYear() ? ctx.todayISO : iso(new Date(monthYear, monthIndex, 1)),
        ),
      };
    }

    return {
      calendar: {
        monthLabel: fmtMonthYear(monthRef),
        dowLabels,
        weeks,
        summary: {
          hoursLabel: fmtH(monthMinutes),
          daysLabel: (monthMinutes / 60 / ctx.hpd).toFixed(1),
          earnLabel: fmtEUR(monthEarn),
          entryCountLabel: `${summaryEntries.length}`,
        },
        panel,
        onPrevMonth: onCalendarPrevMonth,
        onNextMonth: onCalendarNextMonth,
        onToday: onCalendarToday,
      },
      accent: ctx.acc,
    };
  }, [ctx, openEntry, openNewEntryForDate, onSelectClockDay, onCalendarPrevMonth, onCalendarNextMonth, onCalendarToday, onSetCalendarFilter, onClearCalendarFilter]);

  const projectsProps = useMemo<ProjectsViewProps | null>(() => {
    if (!ctx.isProjects) {
      return null;
    }

    const allRows = ctx.S.projects.map((project) => {
      const entries = ctx.S.entries.filter((entry) => entry.kind === 'project' && entry.projectId === project.id);
      const minutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
      const earn = entries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);
      const budgetAmount = project.budget ?? 0;
      const budgetCap = budgetAmount > 0 ? `/ ${fmtEUR(budgetAmount)}` : null;
      const budgetPct = budgetAmount > 0 ? Math.round((earn / budgetAmount) * 100) : null;
      const budgetReached = budgetAmount > 0 && earn >= budgetAmount;
      const isClosed = project.closed === true || budgetReached;
      return {
        id: project.id,
        name: project.name,
        customerName: ctx.custById[project.customerId]?.name || '—',
        dayRate: fmtEUR(currentRatePeriod(project.rates)?.amount ?? 0),
        hours: fmtH(minutes),
        earn: fmtEUR(earn),
        dotStyle: { width: '12px', height: '12px', borderRadius: '4px', background: colorForProject(project, ctx.custById), flexShrink: 0 },
        onClick: () => openProjectDetail(project, { page: 'projects' }),
        budgetCap,
        budgetPct,
        budgetReached,
        isClosed,
      };
    });

    const activeRows = allRows.filter((row) => !row.isClosed);
    const closedRows = allRows.filter((row) => row.isClosed);

    return { activeRows, closedRows, projEmpty: allRows.length === 0 };
  }, [ctx, openProjectDetail]);

  const servicesProps = useMemo<ServicesViewProps | null>(() => {
    if (!ctx.isServices) {
      return null;
    }

    const serviceRows = ctx.S.services.map((service, index) => {
      const entries = ctx.S.entries.filter((entry) => entry.kind === 'service' && entry.serviceId === service.id);
      const minutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
      const earn = entries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);
      return {
        id: service.id,
        name: service.name,
        currentRate: fmtEUR(currentRatePeriod(service.rates)?.amount ?? 0),
        hours: fmtH(minutes),
        earn: fmtEUR(earn),
        dotStyle: { width: '12px', height: '12px', borderRadius: '4px', background: PALETTE[index % PALETTE.length], flexShrink: 0 },
        onClick: () => openServiceDetail(service),
      };
    });

    return { serviceRows, serviceEmpty: serviceRows.length === 0 };
  }, [ctx, openServiceDetail]);

  const customersProps = useMemo<CustomersViewProps | null>(() => {
    if (!ctx.isCustomers) {
      return null;
    }

    const custRows = ctx.S.customers.map((customer) => {
      const projects = ctx.S.projects.filter((project) => project.customerId === customer.id);
      const projectIds = projects.map((project) => project.id);
      const entries = ctx.S.entries.filter(
        (entry) => (entry.kind === 'project' && projectIds.includes(entry.projectId ?? ''))
          || ((entry.kind === 'service' || entry.kind === 'customer') && entry.customerId === customer.id),
      );
      const minutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
      const earn = entries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);
      return {
        id: customer.id,
        name: customer.name,
        projectLabel: `${projects.length}${projects.length === 1 ? ' project' : ' projects'}`,
        hours: fmtH(minutes),
        earn: fmtEUR(earn),
        avatarStyle: {
          width: '40px',
          height: '40px',
          borderRadius: '11px',
          background: customer.color,
          flexShrink: 0,
        },
        onClick: () => navCustomerDetail(customer.id),
      };
    });

    return { custRows, custEmpty: custRows.length === 0 };
  }, [ctx, navCustomerDetail]);

  const modalProps = useMemo<ModalProps | null>(() => {
    const modal = ctx.S.modal;
    if (!modal) {
      return null;
    }

    const isEntryModal = modal.type === 'entry';
    const isCustomerModal = modal.type === 'customer';
    const canDelete = !modal.isNew;
    const entryForm = isEntryModal ? (modal.form as EntryForm) : null;
    const entryId = entryForm?.id ?? '';

    const attachments = (entryForm?.attachments ?? []).map((attachment) => ({
      id: attachment.id,
      label: `${attachment.fileName} (${fmtBytes(attachment.size)})`,
      onDownload: () => void onDownloadAttachment(entryId, attachment.id),
      onDelete: () => onDeleteAttachment(attachment.id),
    }));

    const modalTitle = modal.type === 'entry'
      ? (modal.isNew ? 'Log hours' : 'Edit entry')
      : (modal.isNew ? 'New customer' : 'Edit customer');
    const saveLabel = modal.isNew ? 'Add' : 'Save';

    const presetValues = [0.5, 1, 2, 4, ctx.hpd];
    const seenPresets = new Set<string>();
    const hoursPresets = presetValues
      .filter((value) => {
        const key = String(value);
        if (seenPresets.has(key)) {
          return false;
        }
        seenPresets.add(key);
        return true;
      })
      .map((value) => ({ label: String(value), value: String(value) }));

    const inputStyle: CSSProperties = {
      width: '100%',
      padding: '10px 12px',
      minHeight: '44px',
      border: '1px solid #e2e8f0',
      borderRadius: '9px',
      fontSize: '16px',
      color: '#0f172a',
      background: '#fff',
      outline: 'none',
      transition: 'border-color 0.15s ease',
    };

    return {
      modalTitle,
      saveLabel,
      isEntryModal,
      isCustomerModal,
      canDelete,
      form: modal.form,
      serviceOpts: ctx.S.services.map((service) => ({
        id: service.id,
        name: service.name,
      })),
      custOptsForEntry: ctx.S.customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
      })),
      projOpts: ctx.S.projects
        .filter((project) => {
          if (project.closed) return false;
          const budgetAmount = project.budget ?? 0;
          if (!budgetAmount) return true;
          const earned = ctx.S.entries
            .filter((e) => e.kind === 'project' && e.projectId === project.id)
            .reduce((sum, e) => sum + ctx.entryEarn(e), 0);
          return earned < budgetAmount;
        })
        .map((project) => ({
          id: project.id,
          name: `${project.name}  ·  ${ctx.custById[project.customerId]?.name || '—'}`,
        })),
      inputStyle,
      textareaStyle: { ...inputStyle, resize: 'vertical', lineHeight: 1.4 },
      labelStyle: { display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' },
      btnPrimaryLg: {
        height: '38px',
        padding: '0 20px',
        border: 'none',
        background: `linear-gradient(135deg, ${ctx.acc}, color-mix(in srgb, ${ctx.acc} 72%, #2563eb))`,
        color: '#fff',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13.5px',
        fontWeight: 600,
        letterSpacing: '-0.01em',
      },
      onFormKind: (kind) => {
        updateForm('kind', kind);
        if (kind === 'project' && entryForm && !entryForm.projectId) {
          updateForm('projectId', ctx.S.projects[0]?.id || '');
        }
        if (kind === 'service') {
          if (entryForm && !entryForm.serviceId) {
            updateForm('serviceId', ctx.S.services[0]?.id || '');
          }
          if (entryForm && !entryForm.customerId) {
            updateForm('customerId', ctx.S.customers[0]?.id || '');
          }
        }
        if (kind === 'customer' && entryForm && !entryForm.customerId) {
          updateForm('customerId', ctx.S.customers[0]?.id || '');
        }
      },
      onFormProject: (event: ChangeEvent<HTMLSelectElement>) => updateForm('projectId', event.target.value),
      onFormService: (event: ChangeEvent<HTMLSelectElement>) => updateForm('serviceId', event.target.value),
      onFormEntryCustomer: (event: ChangeEvent<HTMLSelectElement>) => updateForm('customerId', event.target.value),
      onFormAmount: (event: ChangeEvent<HTMLInputElement>) => updateForm('amount', event.target.value),
      onFormDate: (event: ChangeEvent<HTMLInputElement>) => updateForm('date', event.target.value),
      onFormHours: (event: ChangeEvent<HTMLInputElement>) => updateForm('hours', event.target.value),
      hoursPresets,
      onPresetHours: (value: string) => updateForm('hours', value),
      onToggleRepeat: (repeat: boolean) => updateForm('repeat', repeat),
      onFormEndDate: (event: ChangeEvent<HTMLInputElement>) => updateForm('endDate', event.target.value),
      onToggleSkipWeekends: (skip: boolean) => updateForm('skipWeekends', skip),
      onFormComment: (event: ChangeEvent<HTMLTextAreaElement>) => updateForm('comment', event.target.value),
      onFormName: (event: ChangeEvent<HTMLInputElement>) => updateForm('name', event.target.value),
      onSave: saveModal,
      onCancel: closeModal,
      onDelete: deleteModal,
      stopOverlay: (event: MouseEvent) => event.stopPropagation(),
      attachments,
      attachmentUploading: ctx.S.attachmentUploading,
      attachmentError: ctx.S.attachmentError,
      onAddAttachments,
      ...(() => {
        const empty = { budgetWarning: '', budgetRemainingLabel: '' };
        if (!isEntryModal || !modal.isNew || entryForm?.kind !== 'project' || !entryForm.projectId) return empty;
        const project = ctx.S.projects.find((p) => p.id === entryForm.projectId);
        if (!project || !(project.budget ?? 0)) return empty;
        const budget = project.budget!;
        const spent = ctx.S.entries
          .filter((e) => e.kind === 'project' && e.projectId === entryForm.projectId)
          .reduce((sum, e) => sum + ctx.entryEarn(e), 0);
        const remaining = budget - spent;
        const rate = rateForDate(project.rates, entryForm.date);
        const maxHours = rate > 0 ? (remaining / rate) * ctx.hpd : 0;

        if (remaining <= 0) {
          return {
            budgetWarning: `Budget cap of ${fmtEUR(budget)} reached. No new entries can be added to this project.`,
            budgetRemainingLabel: '',
          };
        }

        const budgetRemainingLabel = `${fmtEUR(Math.round(remaining))} remaining · up to ${fmtH(Math.round(maxHours * 60))} at current rate`;

        const entryMinutes = hoursToMinutes(entryForm.hours);
        if (Number.isFinite(entryMinutes) && entryMinutes > 0) {
          const entryEarn = (entryMinutes / 60 / ctx.hpd) * rate;
          if (entryEarn > remaining) {
            return {
              budgetWarning: `This entry (${fmtEUR(Math.round(entryEarn))}) would exceed the remaining budget. Max you can book: ${fmtH(Math.round(maxHours * 60))}.`,
              budgetRemainingLabel,
            };
          }
        }

        return { budgetWarning: '', budgetRemainingLabel };
      })(),
    };
  }, [closeModal, ctx, deleteModal, onAddAttachments, onDeleteAttachment, onDownloadAttachment, saveModal, updateForm]);

  const customerDetailProps = useMemo<CustomerDetailViewProps | null>(() => {
    if (!ctx.isCustomerDetail || !ctx.S.selectedCustomerId) {
      return null;
    }

    const customerId = ctx.S.selectedCustomerId;
    const customer = ctx.custById[customerId];
    const projects = ctx.S.projects.filter((project) => project.customerId === customerId);
    const projectIds = projects.map((project) => project.id);
    const entries = ctx.S.entries.filter(
      (entry) => (entry.kind === 'project' && projectIds.includes(entry.projectId ?? ''))
        || ((entry.kind === 'service' || entry.kind === 'customer') && entry.customerId === customerId),
    );
    const minutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
    const earn = entries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);

    const projectRows: CustomerDetailProjectRowVM[] = projects.map((project) => {
      const projectEntries = ctx.S.entries.filter((entry) => entry.kind === 'project' && entry.projectId === project.id);
      const projectMinutes = projectEntries.reduce((sum, entry) => sum + entry.minutes, 0);
      const projectEarn = projectEntries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);
      return {
        id: project.id,
        name: project.name,
        currentRate: fmtEUR(currentRatePeriod(project.rates)?.amount ?? 0),
        hours: fmtH(projectMinutes),
        earn: fmtEUR(projectEarn),
        dotStyle: { width: '12px', height: '12px', borderRadius: '4px', background: customer?.color || '#9ca3af', flexShrink: 0 },
        onClick: () => openProjectDetail(project, { page: 'customerDetail', customerId }),
      };
    });

    const setCustomerColor = (color: string) => {
      setState((current) => ({
        ...current,
        customers: current.customers.map((item) => (item.id === customerId ? { ...item, color } : item)),
      }));
    };

    const colorSwatches: ColorSwatchVM[] = PALETTE.map((color) => ({
      color,
      style: {
        width: '30px',
        height: '30px',
        borderRadius: '9px',
        background: color,
        cursor: 'pointer',
        padding: 0,
        border: customer?.color === color ? '2px solid #fff' : '2px solid transparent',
        boxShadow: customer?.color === color ? `0 0 0 2px ${color}` : 'none',
      },
      onClick: () => setCustomerColor(color),
    }));

    return {
      customerName: customer?.name || '',
      onNameChange: (event: ChangeEvent<HTMLInputElement>) => {
        const name = event.target.value;
        setState((current) => ({
          ...current,
          customers: current.customers.map((item) => (item.id === customerId ? { ...item, name } : item)),
        }));
      },
      hours: fmtH(minutes),
      earn: fmtEUR(earn),
      projectRows,
      projEmpty: projectRows.length === 0,
      canDelete: true,
      color: customer?.color || '#9ca3af',
      colorSwatches,
      onCustomColorChange: (event: ChangeEvent<HTMLInputElement>) => setCustomerColor(event.target.value),
      inputStyle: {
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #e2e8f0',
        borderRadius: '9px',
        fontSize: '14px',
        color: '#0f172a',
        background: '#fff',
        outline: 'none',
        transition: 'border-color 0.15s ease',
      },
      labelStyle: { display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' },
      btnPrimaryLg: {
        height: '38px',
        padding: '0 20px',
        border: 'none',
        background: `linear-gradient(135deg, ${ctx.acc}, color-mix(in srgb, ${ctx.acc} 72%, #2563eb))`,
        color: '#fff',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13.5px',
        fontWeight: 600,
        letterSpacing: '-0.01em',
      },
      onBack: backToCustomers,
      onNewProject: () => openProjectDetail(null, { page: 'customerDetail', customerId }, customerId),
      onDeleteCustomer: () => {
        if (window.confirm(`Delete ${customer?.name || 'this customer'}? This removes all of its projects and related entries, plus service bookings for this customer.`)) {
          deleteCustomerById(customerId);
        }
      },
      onExport: () => openExport({ type: 'customer', id: customerId }),
      onViewEarnings: () => openEarnings({ customerId, projectId: null }),
    };
  }, [backToCustomers, ctx, deleteCustomerById, openEarnings, openExport, openProjectDetail]);

  const projectDetailProps = useMemo<ProjectDetailViewProps | null>(() => {
    if (!ctx.isProjectDetail || !ctx.S.projectDraft) {
      return null;
    }

    const draft = ctx.S.projectDraft;
    const isNew = !draft.id;
    const entries = draft.id ? ctx.S.entries.filter((entry) => entry.kind === 'project' && entry.projectId === draft.id) : [];
    const minutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
    const earn = entries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);
    const budgetAmount = Number.parseFloat(draft.budget);
    const hasBudget = !isNew && Number.isFinite(budgetAmount) && budgetAmount > 0;
    const budgetPct = hasBudget ? Math.round((earn / budgetAmount) * 100) : null;
    const budgetSpentLabel = hasBudget ? `${fmtEUR(earn)} of ${fmtEUR(budgetAmount)} spent` : '';

    const entryRows: EntryDetailRowVM[] = [...entries]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((entry) => ({
        id: entry.id,
        dateLabel: fmtShortDateYear(parseISO(entry.date)),
        comment: entry.comment,
        hoursLabel: fmtH(entry.minutes),
        earnLabel: fmtEUR(ctx.entryEarn(entry)),
        onClick: () => openEntry(entry, false),
      }));

    const rateRows: RatePeriodRowVM[] = sortRates(draft.rates).map((rate) => ({
      id: rate.id,
      amount: String(rate.amount),
      from: rate.from,
      to: rate.to ?? '',
      isCurrent: rate.to === null,
      onAmountChange: (event: ChangeEvent<HTMLInputElement>) => updateRateField(rate.id, 'amount', event.target.value),
      onFromChange: (event: ChangeEvent<HTMLInputElement>) => updateRateField(rate.id, 'from', event.target.value),
      onToChange: (event: ChangeEvent<HTMLInputElement>) => updateRateField(rate.id, 'to', event.target.value),
      onDelete: () => deleteRate(rate.id),
    }));

    const inputStyle: CSSProperties = {
      width: '100%',
      padding: '10px 12px',
      minHeight: '44px',
      border: '1px solid #e2e8f0',
      borderRadius: '9px',
      fontSize: '16px',
      color: '#0f172a',
      background: '#fff',
      outline: 'none',
      transition: 'border-color 0.15s ease',
    };

    return {
      isNew,
      saveLabel: isNew ? 'Create project' : 'Save changes',
      projectName: draft.name,
      customerId: draft.customerId,
      hours: fmtH(minutes),
      earn: fmtEUR(earn),
      canDelete: !isNew,
      custOpts: ctx.S.customers.map((customer) => ({ id: customer.id, name: customer.name })),
      rateRows,
      entryRows,
      entriesEmpty: entryRows.length === 0,
      newRateAmount: draft.newRateAmount,
      newRateFrom: draft.newRateFrom,
      inputStyle,
      labelStyle: { display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' },
      btnPrimaryLg: {
        height: '38px',
        padding: '0 20px',
        border: 'none',
        background: `linear-gradient(135deg, ${ctx.acc}, color-mix(in srgb, ${ctx.acc} 72%, #2563eb))`,
        color: '#fff',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13.5px',
        fontWeight: 600,
        letterSpacing: '-0.01em',
      },
      onNameChange: (event: ChangeEvent<HTMLInputElement>) => updateProjectDraft('name', event.target.value),
      onCustomerChange: (event: ChangeEvent<HTMLSelectElement>) => updateProjectDraft('customerId', event.target.value),
      onNewRateAmountChange: (event: ChangeEvent<HTMLInputElement>) => updateProjectDraft('newRateAmount', event.target.value),
      onNewRateFromChange: (event: ChangeEvent<HTMLInputElement>) => updateProjectDraft('newRateFrom', event.target.value),
      onAddRate: addRate,
      onSave: saveProjectDraft,
      onDelete: () => {
        if (window.confirm(`Delete ${draft.name || 'this project'}? This removes all of its logged entries.`)) {
          deleteProjectDraft();
        }
      },
      onBack: backFromProjectDetail,
      onExport: () => {
        if (draft.id) {
          openExport({ type: 'project', id: draft.id });
        }
      },
      onViewEarnings: () => {
        if (draft.id) {
          openEarnings({ customerId: draft.customerId, projectId: draft.id });
        }
      },
      budget: draft.budget,
      budgetSpentLabel,
      budgetPct,
      onBudgetChange: (event: ChangeEvent<HTMLInputElement>) => updateProjectDraft('budget', event.target.value),
      closed: draft.closed,
      effectivelyClosed: draft.closed || (hasBudget && earn >= budgetAmount),
      onToggleClosed: toggleProjectClosed,
    };
  }, [addRate, backFromProjectDetail, ctx, deleteProjectDraft, deleteRate, openEarnings, openEntry, openExport, saveProjectDraft, toggleProjectClosed, updateProjectDraft, updateRateField]);

  const serviceDetailProps = useMemo<ServiceDetailViewProps | null>(() => {
    if (!ctx.isServiceDetail || !ctx.S.serviceDraft) {
      return null;
    }

    const draft = ctx.S.serviceDraft;
    const isNew = !draft.id;
    const entries = draft.id ? ctx.S.entries.filter((entry) => entry.kind === 'service' && entry.serviceId === draft.id) : [];
    const minutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
    const earn = entries.reduce((sum, entry) => sum + ctx.entryEarn(entry), 0);

    const rateRows: RatePeriodRowVM[] = sortRates(draft.rates).map((rate) => ({
      id: rate.id,
      amount: String(rate.amount),
      from: rate.from,
      to: rate.to ?? '',
      isCurrent: rate.to === null,
      onAmountChange: (event: ChangeEvent<HTMLInputElement>) => updateServiceRateField(rate.id, 'amount', event.target.value),
      onFromChange: (event: ChangeEvent<HTMLInputElement>) => updateServiceRateField(rate.id, 'from', event.target.value),
      onToChange: (event: ChangeEvent<HTMLInputElement>) => updateServiceRateField(rate.id, 'to', event.target.value),
      onDelete: () => deleteServiceRate(rate.id),
    }));

    const inputStyle: CSSProperties = {
      width: '100%',
      padding: '10px 12px',
      minHeight: '44px',
      border: '1px solid #e2e8f0',
      borderRadius: '9px',
      fontSize: '16px',
      color: '#0f172a',
      background: '#fff',
      outline: 'none',
      transition: 'border-color 0.15s ease',
    };

    return {
      isNew,
      saveLabel: isNew ? 'Create service' : 'Save changes',
      serviceName: draft.name,
      hours: fmtH(minutes),
      earn: fmtEUR(earn),
      canDelete: !isNew,
      rateRows,
      newRateAmount: draft.newRateAmount,
      newRateFrom: draft.newRateFrom,
      inputStyle,
      labelStyle: { display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' },
      btnPrimaryLg: {
        height: '38px',
        padding: '0 20px',
        border: 'none',
        background: `linear-gradient(135deg, ${ctx.acc}, color-mix(in srgb, ${ctx.acc} 72%, #2563eb))`,
        color: '#fff',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13.5px',
        fontWeight: 600,
        letterSpacing: '-0.01em',
      },
      onNameChange: (event: ChangeEvent<HTMLInputElement>) => updateServiceDraft('name', event.target.value),
      onNewRateAmountChange: (event: ChangeEvent<HTMLInputElement>) => updateServiceDraft('newRateAmount', event.target.value),
      onNewRateFromChange: (event: ChangeEvent<HTMLInputElement>) => updateServiceDraft('newRateFrom', event.target.value),
      onAddRate: addServiceRate,
      onSave: saveServiceDraft,
      onDelete: deleteServiceDraft,
      onBack: backFromServiceDetail,
    };
  }, [addServiceRate, backFromServiceDetail, ctx, deleteServiceDraft, deleteServiceRate, saveServiceDraft, updateServiceDraft, updateServiceRateField]);

  const exportProps = useMemo<ExportViewProps | null>(() => {
    if (!ctx.isExport) {
      return null;
    }

    return {
      customers: ctx.S.customers,
      projects: ctx.S.projects,
      services: ctx.S.services,
      entries: ctx.S.entries,
      hoursPerDay: ctx.hpd,
      initialScope: ctx.S.exportScope,
      onBack: () => setPage('clock'),
    };
  }, [ctx, setPage]);

  const earningsProps = useMemo<EarningsViewProps | null>(() => {
    if (!ctx.isEarnings) {
      return null;
    }

    return {
      customers: ctx.S.customers,
      projects: ctx.S.projects,
      services: ctx.S.services,
      entries: ctx.S.entries,
      hoursPerDay: ctx.hpd,
      initialFilter: ctx.S.earningsFilter,
      onBack: () => setPage('clock'),
    };
  }, [ctx, setPage]);

  return {
    showClock: ctx.isClock,
    showProjects: ctx.isProjects,
    showServices: ctx.isServices,
    showCustomers: ctx.isCustomers,
    showSettings: ctx.isSettings,
    showCustomerDetail: ctx.isCustomerDetail,
    showProjectDetail: ctx.isProjectDetail,
    showServiceDetail: ctx.isServiceDetail,
    showExport: ctx.isExport,
    showEarnings: ctx.isEarnings,
    modalOpen: Boolean(ctx.S.modal),
    sidebarProps,
    headerProps,
    clockProps,
    projectsProps,
    servicesProps,
    customersProps,
    settingsProps,
    customerDetailProps,
    projectDetailProps,
    serviceDetailProps,
    exportProps,
    earningsProps,
    modalProps,
  };
}

