// Shared domain and view-model types for Tempo.
// This file is the single source of truth for the "shape" of data
// flowing between the state hook (useTempoState) and the presentational
// components. Keep it in sync with both sides.

import type { CSSProperties, MouseEvent, ChangeEvent } from 'react';

// ─── domain model ────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  customerId: string;
  dayRate: number;
  color: string;
}

export interface Entry {
  id: string;
  date: string;        // ISO yyyy-mm-dd
  projectId: string;
  start: number;        // minutes from midnight
  end: number;          // minutes from midnight
  comment: string;
}

export type Page = 'track' | 'projects' | 'customers' | 'settings';
export type View = 'week' | 'day' | 'month';
export type GistStatus = 'idle' | 'syncing' | 'synced' | 'error';

export type ModalType = 'entry' | 'project' | 'customer';

export interface EntryForm {
  id: string | null;
  projectId: string;
  date: string;
  start: string;  // "HH:MM"
  end: string;    // "HH:MM"
  comment: string;
}

export interface ProjectForm {
  id: string | null;
  name: string;
  customerId: string;
  dayRate: string;
  color: string;
}

export interface CustomerForm {
  id: string | null;
  name: string;
}

export type ModalForm = EntryForm | ProjectForm | CustomerForm;

export interface ModalState {
  type: ModalType;
  isNew: boolean;
  form: ModalForm;
}

export interface DragState {
  iso: string;
  a: number;
  b: number;
}

export interface PersistedData {
  customers: Customer[];
  projects: Project[];
  entries: Entry[];
}

// ─── app-level settings (equivalent to DC `props`) ──────────────────────

export interface TempoSettings {
  accentColor: string;
  hoursPerDay: number;
  showWeekend: boolean;
}

// ─── view-model props (one interface per component) ─────────────────────

export interface SidebarProps {
  logoStyle: CSSProperties;
  navTrackStyle: CSSProperties;
  navProjectsStyle: CSSProperties;
  navCustomersStyle: CSSProperties;
  onNavTrack: () => void;
  onNavProjects: () => void;
  onNavCustomers: () => void;
  weekHours: string;
  weekDaysStr: string;
  weekEarnStr: string;
  syncColor: string;
  syncLabel: string;
  onOpenSettings: () => void;
}

export interface AppHeaderProps {
  headerTitle: string;
  headerSubtitle: string;
  isTrack: boolean;
  isProjects: boolean;
  isCustomers: boolean;
  tabDayStyle: CSSProperties;
  tabWeekStyle: CSSProperties;
  tabMonthStyle: CSSProperties;
  onTabDay: () => void;
  onTabWeek: () => void;
  onTabMonth: () => void;
  onPrev: () => void;
  onToday: () => void;
  onNext: () => void;
  btnPrimary: CSSProperties;
  onNewEntry: () => void;
  onNewProject: () => void;
  onNewCustomer: () => void;
}

export interface EntryBlockVM {
  id: string;
  projectName: string;
  comment: string;
  timeLabel: string;
  style: CSSProperties;
  onClick: () => void;
  stop: (e: MouseEvent) => void;
}

export interface WeekDayVM {
  iso: string;
  dow: string;
  dayNum: number;
  numStyle: CSSProperties;
  colStyle: CSSProperties;
  entries: EntryBlockVM[];
  drag: CSSProperties | null;
  dragLabel: string;
  onMouseDown: (e: MouseEvent) => void;
  onHeaderClick: () => void;
}

export interface HourRowVM {
  label: string;
  style: CSSProperties;
}

export interface WeekViewProps {
  weekDays: WeekDayVM[];
  gutterStyle: CSSProperties;
  hourRows: HourRowVM[];
}

export interface DayListRowVM {
  id: string;
  projectName: string;
  comment: string;
  timeLabel: string;
  dotStyle: CSSProperties;
  onClick: () => void;
}

export interface DayDataVM {
  colStyle: CSSProperties;
  entries: EntryBlockVM[];
  drag: CSSProperties | null;
  dragLabel: string;
  onMouseDown: (e: MouseEvent) => void;
  totalH: string;
  totalDays: string;
  totalEarn: string;
  empty: boolean;
  list: DayListRowVM[];
}

export interface DayViewProps {
  dayData: DayDataVM;
  gutterStyle: CSSProperties;
  hourRows: HourRowVM[];
  accent: string;
}

export interface MonthDotVM {
  style: CSSProperties;
}

export interface MonthCellVM {
  dayNum: number;
  style: CSSProperties;
  numStyle: CSSProperties;
  hasEntries: boolean;
  hours: string;
  earn: string;
  dots: MonthDotVM[];
  onClick: () => void;
}

export interface MonthWeekVM {
  days: MonthCellVM[];
}

export interface MonthViewProps {
  monthWeeks: MonthWeekVM[];
  monthDowLabels: string[];
}

export interface ProjectRowVM {
  id: string;
  name: string;
  customerName: string;
  dayRate: string;
  hours: string;
  earn: string;
  dotStyle: CSSProperties;
  onClick: () => void;
}

export interface ProjectsViewProps {
  projRows: ProjectRowVM[];
  projEmpty: boolean;
}

export interface CustomerRowVM {
  id: string;
  name: string;
  initials: string;
  projectLabel: string;
  hours: string;
  earn: string;
  avatarStyle: CSSProperties;
  onClick: () => void;
}

export interface CustomersViewProps {
  custRows: CustomerRowVM[];
  custEmpty: boolean;
}

export interface SelectOptionVM {
  id: string;
  name: string;
}

export interface ColorSwatchVM {
  color: string;
  style: CSSProperties;
  onClick: () => void;
}

export interface ModalProps {
  modalTitle: string;
  saveLabel: string;
  isEntryModal: boolean;
  isProjectModal: boolean;
  isCustomerModal: boolean;
  canDelete: boolean;
  form: ModalForm;
  projOpts: SelectOptionVM[];
  custOpts: SelectOptionVM[];
  colorSwatches: ColorSwatchVM[];
  inputStyle: CSSProperties;
  textareaStyle: CSSProperties;
  labelStyle: CSSProperties;
  btnPrimaryLg: CSSProperties;
  onFormProject: (e: ChangeEvent<HTMLSelectElement>) => void;
  onFormDate: (e: ChangeEvent<HTMLInputElement>) => void;
  onFormStart: (e: ChangeEvent<HTMLInputElement>) => void;
  onFormEnd: (e: ChangeEvent<HTMLInputElement>) => void;
  onFormComment: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onFormName: (e: ChangeEvent<HTMLInputElement>) => void;
  onFormCustomer: (e: ChangeEvent<HTMLSelectElement>) => void;
  onFormRate: (e: ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  stopOverlay: (e: MouseEvent) => void;
}

// ─── settings page (GitHub sync, demo mode, danger zone) ────────────────

export interface SettingsViewProps {
  onBack: () => void;

  // Demo mode
  demoMode: boolean;
  onToggleDemoMode: () => void;
  demoModeHint: string;

  // GitHub Gist sync (disabled while demo mode is active)
  syncDisabled: boolean;
  patValue: string;
  onPatChange: (e: ChangeEvent<HTMLInputElement>) => void;
  gistIdLabel: string;
  gistConnected: boolean;
  gistStatusLabel: string;
  gistStatusColor: string;
  onConnect: () => void;
  onSyncNow: () => void;
  onRestoreFromGist: () => void;
  onDisconnect: () => void;

  // Danger zone
  onDeleteAll: () => void;
}

// ─── the aggregate view-model returned by useTempoState() ───────────────

export interface TempoViewModel {
  showWeek: boolean;
  showDay: boolean;
  showMonth: boolean;
  showProjects: boolean;
  showCustomers: boolean;
  showSettings: boolean;
  modalOpen: boolean;
  sidebarProps: SidebarProps;
  headerProps: AppHeaderProps;
  weekProps: WeekViewProps | null;
  dayProps: DayViewProps | null;
  monthProps: MonthViewProps | null;
  projectsProps: ProjectsViewProps | null;
  customersProps: CustomersViewProps | null;
  settingsProps: SettingsViewProps | null;
  modalProps: ModalProps | null;
}
