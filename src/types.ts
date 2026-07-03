// Shared domain and view-model types for Tempo.
// This file is the single source of truth for the "shape" of data
// flowing between the state hook (useTempoState) and the presentational
// components. Keep it in sync with both sides.

import type { CSSProperties, MouseEvent, PointerEvent, ChangeEvent } from 'react';

// ─── domain model ────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  color: string;
}

// A time-bound rate for a project. Periods never overlap: `to: null` marks
// the currently active ("open") period. Adding a new rate closes the
// previously open period the day before the new period's `from` date.
export interface RatePeriod {
  id: string;
  amount: number;
  from: string;        // ISO yyyy-mm-dd, inclusive
  to: string | null;    // ISO yyyy-mm-dd, inclusive, or null = open-ended/current
}

export interface Project {
  id: string;
  name: string;
  customerId: string;
  rates: RatePeriod[];
}

// A file uploaded against a time entry (e.g. a receipt or screenshot).
// The blob itself lives in Azure Blob Storage at "<entryId>/<id>"; this
// record is only the metadata needed to list/download/delete it.
export interface AttachmentRef {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
}

export interface Entry {
  id: string;
  date: string;        // ISO yyyy-mm-dd
  projectId: string;
  start: number;        // minutes from midnight
  end: number;          // minutes from midnight
  comment: string;
  attachments: AttachmentRef[];
}

export type Page = 'track' | 'projects' | 'customers' | 'settings' | 'customerDetail' | 'projectDetail' | 'export';
export type View = 'week' | 'day' | 'month';
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'conflict';

export type ModalType = 'entry' | 'customer';

export interface EntryForm {
  id: string | null;
  projectId: string;
  date: string;
  start: string;  // "HH:MM"
  end: string;    // "HH:MM"
  comment: string;
  attachments: AttachmentRef[];
}

export interface ProjectForm {
  id: string | null;
  name: string;
  customerId: string;
  rates: RatePeriod[];
  newRateAmount: string;
  newRateFrom: string;
}

export interface CustomerForm {
  id: string | null;
  name: string;
  color: string;
}

export type ModalForm = EntryForm | CustomerForm;

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
  navExportStyle: CSSProperties;
  onNavTrack: () => void;
  onNavProjects: () => void;
  onNavCustomers: () => void;
  onNavExport: () => void;
  weekHours: string;
  weekDaysStr: string;
  weekEarnStr: string;
  syncColor: string;
  syncLabel: string;
  onOpenSettings: () => void;
  isOpen?: boolean;
  onClose?: () => void;
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
  onToggleSidebar?: () => void;
  isMobile?: boolean;
  sidebarOpen?: boolean;
}

export interface EntryBlockVM {
  id: string;
  projectName: string;
  comment: string;
  timeLabel: string;
  style: CSSProperties;
  onClick: () => void;
  stop: (e: PointerEvent) => void;
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
  onPointerDown: (e: PointerEvent) => void;
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
  onPointerDown: (e: PointerEvent) => void;
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

export interface RatePeriodRowVM {
  id: string;
  amount: string;
  from: string;
  to: string;           // '' means open/current
  isCurrent: boolean;
  onAmountChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onFromChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onToChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onDelete: () => void;
}

export interface AttachmentListItemVM {
  id: string;
  label: string;
  onDownload: () => void;
  onDelete: () => void;
}

export interface ModalProps {
  modalTitle: string;
  saveLabel: string;
  isEntryModal: boolean;
  isCustomerModal: boolean;
  canDelete: boolean;
  form: ModalForm;
  projOpts: SelectOptionVM[];
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
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  stopOverlay: (e: MouseEvent) => void;
  attachments: AttachmentListItemVM[];
  attachmentUploading: boolean;
  attachmentError: string;
  onAddAttachments: (e: ChangeEvent<HTMLInputElement>) => void;
}

// ─── customer detail page (drill down from Customers list) ──────────────

export interface CustomerDetailProjectRowVM {
  id: string;
  name: string;
  currentRate: string;
  hours: string;
  earn: string;
  dotStyle: CSSProperties;
  onClick: () => void;
}

export interface CustomerDetailViewProps {
  customerName: string;
  onNameChange: (e: ChangeEvent<HTMLInputElement>) => void;
  hours: string;
  earn: string;
  projectRows: CustomerDetailProjectRowVM[];
  projEmpty: boolean;
  canDelete: boolean;
  color: string;
  colorSwatches: ColorSwatchVM[];
  onCustomColorChange: (e: ChangeEvent<HTMLInputElement>) => void;
  inputStyle: CSSProperties;
  labelStyle: CSSProperties;
  btnPrimaryLg: CSSProperties;
  onBack: () => void;
  onNewProject: () => void;
  onDeleteCustomer: () => void;
  onExport: () => void;
}

// ─── project detail page (drill down from Projects list or a customer) ──

export interface ProjectDetailViewProps {
  isNew: boolean;
  saveLabel: string;
  projectName: string;
  customerId: string;
  hours: string;
  earn: string;
  canDelete: boolean;
  custOpts: SelectOptionVM[];
  rateRows: RatePeriodRowVM[];
  newRateAmount: string;
  newRateFrom: string;
  inputStyle: CSSProperties;
  labelStyle: CSSProperties;
  btnPrimaryLg: CSSProperties;
  onNameChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onCustomerChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  onNewRateAmountChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onNewRateFromChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onAddRate: () => void;
  onSave: () => void;
  onDelete: () => void;
  onBack: () => void;
  onExport: () => void;
}

// ─── timesheet export page (PDF + attachments zip for a customer or project) ──

export type ExportScope = { type: 'customer'; id: string } | { type: 'project'; id: string };

export interface ExportViewProps {
  customers: Customer[];
  projects: Project[];
  entries: Entry[];
  hoursPerDay: number;
  initialScope: ExportScope | null;
  onBack: () => void;
}

// ─── settings page (GitHub sync, demo mode, danger zone) ────────────────

export interface SettingsViewProps {
  onBack: () => void;

  // Demo mode
  demoMode: boolean;
  onToggleDemoMode: () => void;
  demoModeHint: string;

  // Azure sync (GET/PUT /api/state, disabled while demo mode is active)
  syncDisabled: boolean;
  syncStatusLabel: string;
  syncStatusColor: string;
  onSyncNow: () => void;
  signedInAs: string;
  onSignOut: () => void;

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
  showCustomerDetail: boolean;
  showProjectDetail: boolean;
  showExport: boolean;
  modalOpen: boolean;
  sidebarProps: SidebarProps;
  headerProps: AppHeaderProps;
  weekProps: WeekViewProps | null;
  dayProps: DayViewProps | null;
  monthProps: MonthViewProps | null;
  projectsProps: ProjectsViewProps | null;
  customersProps: CustomersViewProps | null;
  settingsProps: SettingsViewProps | null;
  customerDetailProps: CustomerDetailViewProps | null;
  projectDetailProps: ProjectDetailViewProps | null;
  exportProps: ExportViewProps | null;
  modalProps: ModalProps | null;
}
