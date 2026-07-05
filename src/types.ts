// Shared domain and view-model types for the app.
// This file is the single source of truth for the "shape" of data
// flowing between the state hook (useAppState) and the presentational
// components. Keep it in sync with both sides.

import type { CSSProperties, MouseEvent, ChangeEvent } from 'react';

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
  budget?: number | null;  // optional budget cap in €; undefined/null/0 = no cap
  closed?: boolean;        // manually closed; budget-exceeded projects are also treated as closed
}

export interface Service {
  id: string;
  name: string;
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
  kind: 'project' | 'service' | 'customer';
  projectId: string | null;
  serviceId: string | null;
  customerId: string | null;
  // Flat fee for a 'customer' entry, tied only to that specific entry (no
  // rate table, no proration). Null for 'project'/'service' entries.
  amount: number | null;
  minutes: number;      // logged duration in minutes
  comment: string;
  attachments: AttachmentRef[];
}

export type Page = 'track' | 'projects' | 'services' | 'customers' | 'settings' | 'customerDetail' | 'projectDetail' | 'serviceDetail' | 'export' | 'earnings';
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'conflict';

export type ModalType = 'entry' | 'customer';

export interface EntryForm {
  id: string | null;
  kind: 'project' | 'service' | 'customer';
  projectId: string;
  serviceId: string;
  customerId: string;
  amount: string;  // flat fee for 'customer' kind, as text input
  date: string;
  hours: string;   // logged duration in hours, as text input (e.g. "2.5")
  // Recurring/multi-day quick entry. When `repeat` is true the modal creates
  // one entry per included day between `date` and `endDate` (inclusive),
  // skipping Saturdays/Sundays when `skipWeekends` is set.
  repeat: boolean;
  endDate: string;        // ISO yyyy-mm-dd, used only when `repeat`
  skipWeekends: boolean;
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
  budget: string;   // raw text input for budget cap ('' or '5000'); empty = no cap
  closed: boolean;
}

export interface ServiceForm {
  id: string | null;
  name: string;
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

export interface PersistedData {
  customers: Customer[];
  projects: Project[];
  services: Service[];
  entries: Entry[];
}

// ─── app-level settings (equivalent to DC `props`) ──────────────────────

export interface AppSettings {
  accentColor: string;
  hoursPerDay: number;
  showWeekend: boolean;
}

// ─── view-model props (one interface per component) ─────────────────────

export interface SidebarProps {
  logoStyle: CSSProperties;
  navTrackStyle: CSSProperties;
  navProjectsStyle: CSSProperties;
  navServicesStyle: CSSProperties;
  navCustomersStyle: CSSProperties;
  navExportStyle: CSSProperties;
  navEarningsStyle: CSSProperties;
  onNavTrack: () => void;
  onNavProjects: () => void;
  onNavServices: () => void;
  onNavCustomers: () => void;
  onNavExport: () => void;
  onNavEarnings: () => void;
  periodLabel: string;
  monthHours: string;
  monthDaysStr: string;
  monthEarnStr: string;
  syncColor: string;
  syncLabel: string;
  syncStatus: SyncStatus;
  onOpenSettings: () => void;
  accent: string;
  isAuthenticated: boolean;
  onSignIn: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export interface AppHeaderProps {
  headerTitle: string;
  headerSubtitle: string;
  isTrack: boolean;
  isProjects: boolean;
  isServices: boolean;
  isCustomers: boolean;
  onPrev: () => void;
  onToday: () => void;
  onNext: () => void;
  btnPrimary: CSSProperties;
  onNewEntry: () => void;
  onNewProject: () => void;
  onNewService: () => void;
  onNewCustomer: () => void;
  onToggleSidebar?: () => void;
  isMobile?: boolean;
  sidebarOpen?: boolean;
}

// A single logged entry shown in the timesheet list on a project's (or
// service's) detail page. Grouped by project/service and labelled by date
// since the project/service is already implied by the page.
export interface EntryDetailRowVM {
  id: string;
  dateLabel: string;    // e.g. "Jul 2, 2026"
  comment: string;
  hoursLabel: string;   // e.g. "2.5h"
  earnLabel: string;    // e.g. "€320"
  onClick: () => void;
}

// One entry shown in the Track day-detail side panel for a selected day.
export interface TrackDayEntryVM {
  id: string;
  name: string;              // project/service/customer name
  subLabel: string;          // customer name, "Flat fee", or a comment preview
  dotColor: string;
  hoursLabel: string;        // '' for customer flat-fee entries (no hours)
  earnLabel: string;         // '' when nothing earned
  onClick: () => void;       // opens the entry modal for editing
}

// One day cell in the Track month grid. Shading + pips encode hours logged
// and which contexts (projects/services/customers) were touched that day.
// Clicking selects the day into the side panel; clicking the selected day
// again returns the panel to the month-at-a-glance state.
export interface TrackMonthDayVM {
  iso: string;
  dayNum: number;
  isToday: boolean;
  isCurrentMonth: boolean;   // false for leading/trailing days of adjacent months
  isWeekend: boolean;
  isSelected: boolean;
  hasData: boolean;
  hoursLabel: string;        // '' when empty
  earnLabel: string;         // '' when nothing earned
  pips: string[];            // dot colors for distinct contexts logged that day
  title: string;             // hover tooltip
  onClick: () => void;
}

export interface TrackWeekRowVM {
  weekLabel: string;         // e.g. "W27"
  hoursLabel: string;        // '' when the week is empty
  hasWeekendData: boolean;   // true when Sat or Sun has logged hours (shown as indicator on mobile)
  days: TrackMonthDayVM[];
}

// Side panel, day-detail state — shown once a day is selected.
export interface TrackDayPanelVM {
  mode: 'day';
  iso: string;
  dateLabel: string;         // e.g. "Thursday, Jul 2"
  hoursLabel: string;
  earnLabel: string;
  entries: TrackDayEntryVM[];
  onAddEntry: () => void;
  onBack: () => void;        // return to month-at-a-glance
}

export interface TrackMonthGlanceProjectVM {
  key: string;
  name: string;
  subLabel: string;
  dotColor: string;
  hoursLabel: string;
  earnLabel: string;
  barPct: number;            // 0-100, relative to the busiest project this month
  isFiltered: boolean;       // true when this row is the active filter
  onFilter: () => void;      // toggle this row as the active filter
}

// Side panel, month-at-a-glance state — the default when no day is selected.
export interface TrackMonthGlanceVM {
  mode: 'glance';
  topProjects: TrackMonthGlanceProjectVM[];
  filterLabel: string | null;  // name of the active filter, null when unfiltered
  onClearFilter: () => void;
  onAddEntry: () => void;
}

// Summary stats for the month currently displayed in the calendar, shown in
// a strip above the grid regardless of which side-panel state is active.
export interface TrackMonthSummaryVM {
  hoursLabel: string;
  daysLabel: string;
  earnLabel: string;
  entryCountLabel: string;
}

export interface TrackCalendarVM {
  monthLabel: string;        // e.g. "July 2026"
  dowLabels: string[];       // Mon..Sun column headers
  weeks: TrackWeekRowVM[];
  summary: TrackMonthSummaryVM;
  panel: TrackDayPanelVM | TrackMonthGlanceVM;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

export interface TrackViewProps {
  calendar: TrackCalendarVM;
  accent: string;
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
  budgetCap: string | null;    // e.g. "/ €5,000"; null if no budget set
  budgetPct: number | null;    // 0–100+ percentage of budget spent; null if no budget
  budgetReached: boolean;
  isClosed: boolean;           // true when manually closed or budget cap reached
}

export interface ProjectsViewProps {
  activeRows: ProjectRowVM[];
  closedRows: ProjectRowVM[];
  projEmpty: boolean;
}

export interface ServiceRowVM {
  id: string;
  name: string;
  currentRate: string;
  hours: string;
  earn: string;
  dotStyle: CSSProperties;
  onClick: () => void;
}

export interface ServicesViewProps {
  serviceRows: ServiceRowVM[];
  serviceEmpty: boolean;
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

export interface HoursPresetVM {
  label: string;
  value: string;
}

export interface ModalProps {
  modalTitle: string;
  saveLabel: string;
  isEntryModal: boolean;
  isCustomerModal: boolean;
  canDelete: boolean;
  form: ModalForm;
  projOpts: SelectOptionVM[];
  serviceOpts: SelectOptionVM[];
  custOptsForEntry: SelectOptionVM[];
  inputStyle: CSSProperties;
  textareaStyle: CSSProperties;
  labelStyle: CSSProperties;
  btnPrimaryLg: CSSProperties;
  onFormKind: (kind: 'project' | 'service' | 'customer') => void;
  onFormProject: (e: ChangeEvent<HTMLSelectElement>) => void;
  onFormService: (e: ChangeEvent<HTMLSelectElement>) => void;
  onFormEntryCustomer: (e: ChangeEvent<HTMLSelectElement>) => void;
  onFormAmount: (e: ChangeEvent<HTMLInputElement>) => void;
  onFormDate: (e: ChangeEvent<HTMLInputElement>) => void;
  onFormHours: (e: ChangeEvent<HTMLInputElement>) => void;
  hoursPresets: HoursPresetVM[];
  onPresetHours: (value: string) => void;
  onToggleRepeat: (repeat: boolean) => void;
  onFormEndDate: (e: ChangeEvent<HTMLInputElement>) => void;
  onToggleSkipWeekends: (skip: boolean) => void;
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
  budgetWarning: string;          // non-empty when selected project's budget is already spent or would be exceeded
  budgetRemainingLabel: string;   // e.g. "€1,600 remaining · up to 2.5h at current rate"; empty if no budget/remaining
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
  onViewEarnings: () => void;
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
  entryRows: EntryDetailRowVM[];
  entriesEmpty: boolean;
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
  onViewEarnings: () => void;
  // Budget cap (optional)
  budget: string;              // text input value for budget cap; '' = no cap
  budgetSpentLabel: string;    // e.g. "€2,400 of €5,000 spent"; '' if no budget
  budgetPct: number | null;    // null if no budget
  onBudgetChange: (e: ChangeEvent<HTMLInputElement>) => void;
  // Close / reopen
  closed: boolean;             // true when manually closed (not budget-auto-close)
  effectivelyClosed: boolean;  // true when closed OR budget cap reached
  onToggleClosed: () => void;
}

export interface ServiceDetailViewProps {
  isNew: boolean;
  saveLabel: string;
  serviceName: string;
  hours: string;
  earn: string;
  canDelete: boolean;
  rateRows: RatePeriodRowVM[];
  newRateAmount: string;
  newRateFrom: string;
  inputStyle: CSSProperties;
  labelStyle: CSSProperties;
  btnPrimaryLg: CSSProperties;
  onNameChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onNewRateAmountChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onNewRateFromChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onAddRate: () => void;
  onSave: () => void;
  onDelete: () => void;
  onBack: () => void;
}

// ─── timesheet export page (PDF + attachments zip for a customer or project) ──

export type ExportScope = { type: 'customer'; id: string } | { type: 'project'; id: string };

export interface ExportViewProps {
  customers: Customer[];
  projects: Project[];
  services: Service[];
  entries: Entry[];
  hoursPerDay: number;
  initialScope: ExportScope | null;
  onBack: () => void;
}

// ─── earnings analytics page (totals + breakdown by customer/project) ──

// Seeds the page-local filter when deep-linking in from a customer/project
// detail page's "View earnings" button.
export interface EarningsFilterSeed {
  customerId: string | null;
  projectId: string | null;
}

export interface EarningsRowVM {
  id: string;
  name: string;
  dotStyle: CSSProperties;
  hours: string;
  days: string;
  earn: string;
  share: string; // e.g. "42%"
}

export interface EarningsViewProps {
  customers: Customer[];
  projects: Project[];
  services: Service[];
  entries: Entry[];
  hoursPerDay: number;
  initialFilter: EarningsFilterSeed | null;
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
  isAuthenticated: boolean;
  onSignIn: () => void;

  // Danger zone
  onDeleteAll: () => void;
}

// ─── the aggregate view-model returned by useAppState() ─────────────────

export interface AppViewModel {
  showTrack: boolean;
  showProjects: boolean;
  showServices: boolean;
  showCustomers: boolean;
  showSettings: boolean;
  showCustomerDetail: boolean;
  showProjectDetail: boolean;
  showServiceDetail: boolean;
  showExport: boolean;
  showEarnings: boolean;
  modalOpen: boolean;
  sidebarProps: SidebarProps;
  headerProps: AppHeaderProps;
  trackProps: TrackViewProps | null;
  projectsProps: ProjectsViewProps | null;
  servicesProps: ServicesViewProps | null;
  customersProps: CustomersViewProps | null;
  settingsProps: SettingsViewProps | null;
  customerDetailProps: CustomerDetailViewProps | null;
  projectDetailProps: ProjectDetailViewProps | null;
  serviceDetailProps: ServiceDetailViewProps | null;
  exportProps: ExportViewProps | null;
  earningsProps: EarningsViewProps | null;
  modalProps: ModalProps | null;
}
