// src/app/features/appointments/AppointmentsPage.tsx
import React from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  MenuItem,
  Select,
  CircularProgress,
  TablePagination,
  TextField,
  TableSortLabel,
  Chip,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  Checkbox,
  ListItemText,
  Tabs,
  Tab,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAppointments,
  getAppointment,
  checkInAppointment,
  startConsultation,
  completeAppointment,
  cancelAppointment,
  markNoShow,
  rescheduleAppointment,
} from "@app/lib/api/appointments";
import { getPrescription } from "@app/lib/api/prescriptions";
import { apiClient } from "@app/lib/apiClient";
import PageToolbar from "@app/components/common/PageToolbar";
import { 
  Add as AddIcon, 
  Inbox as EmptyIcon, 
  Event as EventIcon, 
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  PlayArrow as PlayArrowIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  LocalPharmacy as LocalPharmacyIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom"; // Only for id param, not filters
// Using native Date methods instead of date-fns
import AppointmentFormDialog from "./AppointmentFormDialog";
import PrescriptionFormDialog from "@app/features/prescriptions/PrescriptionFormDialog";
import AppointmentDetailDialog from "@app/components/appointments/AppointmentDetailDialog";
import { useAuthStore } from "@app/store/authStore";
import { can } from "@app/lib/abac";
import { useToast } from "@app/components/common/ToastProvider";
import { isEligibleOPD, canCheckIn, canReschedule, canCancel, canCloseVisit, shouldMarkNoShow } from "@app/lib/utils/appointmentEligibility";
// Appointment type is inferred from API responses
type Appointment = any;
import { getAppointmentStatusLabel, getAppointmentStatusColor, getPrescriptionStatusLabel, getPrescriptionStatusColor } from "@app/lib/utils/statusUtils";
import {
  formatDateTimeLocal,
  parseDateTimeLocal,
  toUTCISOString,
  getNext15MinuteSlot,
  isValid15MinuteInterval,
  roundToNext15Minutes,
  roundToNearest15Minutes,
} from "@app/lib/dateTimeUtils";

type Order = "asc" | "desc";
type OrderBy = "scheduled_at" | "patient_name";

// Valid appointment statuses
const VALID_APPOINTMENT_STATUSES = ["SCHEDULED", "CHECKED_IN", "IN_CONSULTATION", "COMPLETED", "NO_SHOW", "CANCELLED"];

// Terminal statuses (past outcomes - should not appear in UPCOMING/TODAY by default)
const TERMINAL_STATUSES = ["COMPLETED", "CANCELLED", "NO_SHOW"];

// Active/operational statuses (non-terminal)
const ACTIVE_STATUSES = ["SCHEDULED", "CHECKED_IN", "IN_CONSULTATION"];

// Time segment types
type TimeSegment = "UPCOMING" | "TODAY" | "PAST" | "ALL";


const AppointmentsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  // Only use searchParams for id param (special case for opening detail dialog)
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  
  // Time segment state (default: UPCOMING)
  // Allow setting initial segment from URL param (for navigation from dashboard)
  const initialSegmentParam = searchParams.get("segment");
  const validSegments: TimeSegment[] = ["UPCOMING", "TODAY", "PAST", "ALL"];
  const initialSegment = initialSegmentParam && validSegments.includes(initialSegmentParam as TimeSegment) 
    ? (initialSegmentParam as TimeSegment) 
    : "UPCOMING";
  const [timeSegment, setTimeSegment] = React.useState<TimeSegment>(initialSegment);
  // Track if user has manually changed sorting (to preserve their choice when switching segments)
  const [hasManualSort, setHasManualSort] = React.useState(false);

  // Helper to format date as YYYY-MM-DD in local timezone (not UTC)
  // This prevents timezone conversion issues when converting Date to string
  const formatDateLocal = React.useCallback((date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Calculate time boundaries in client local time
  // startOfToday: today at 00:00:00 in local timezone
  // startOfTomorrow: tomorrow at 00:00:00 in local timezone
  const getTimeBoundaries = React.useCallback(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    return { startOfToday, startOfTomorrow };
  }, []);

  // Local state for filters, search, pagination, and sorting
  // Allow initial values from URL params (for navigation from dashboard)
  const initialSearch = searchParams.get("search") || "";
  const initialDoctorFilter = searchParams.get("doctor_user_id") || "all";
  const initialDepartmentFilter = searchParams.get("department_id") || "all";
  const initialStatusFilterParam = searchParams.get("status");
  const initialDateFrom = searchParams.get("date_from") || undefined;
  const initialDateTo = searchParams.get("date_to") || undefined;
  
  // Parse initial status filter from URL
  const getInitialStatusFilter = (): string | string[] => {
    if (!initialStatusFilterParam) return getDefaultStatusFilterForSegment(initialSegment);
    const statusArray = initialStatusFilterParam.split(",");
    const validStatuses = statusArray.filter(s => VALID_APPOINTMENT_STATUSES.includes(s));
    return validStatuses.length > 0 ? (validStatuses.length === 1 ? validStatuses[0] : validStatuses) : getDefaultStatusFilterForSegment(initialSegment);
  };
  
  const [search, setSearch] = React.useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = React.useState(initialSearch);
  const [doctorFilter, setDoctorFilter] = React.useState<string>(initialDoctorFilter);
  const [departmentFilter, setDepartmentFilter] = React.useState<string>(initialDepartmentFilter);
  
  // Default status filter per segment:
  // - UPCOMING/TODAY: only active statuses (exclude terminal)
  // - PAST: terminal statuses (history-first)
  // - ALL: none (means "all statuses")
  const getDefaultStatusFilterForSegment = React.useCallback((segment: TimeSegment): string | string[] => {
    switch (segment) {
      case "UPCOMING":
      case "TODAY":
        // Show only non-terminal statuses by default
        // Terminal statuses (COMPLETED, CANCELLED, NO_SHOW) are excluded from Upcoming/Today
        // because they represent past outcomes and don't belong in operational views
        return ACTIVE_STATUSES;
      case "PAST":
        // Show terminal statuses by default (history-first view)
        return TERMINAL_STATUSES;
      case "ALL":
        // Show everything (no status filter = all statuses)
        return "all";
      default:
        return "all";
    }
  }, []);

  // Default date filters per segment
  const getDefaultDateFiltersForSegment = React.useCallback((segment: TimeSegment): { date_from: string | undefined; date_to: string | undefined } => {
    const { startOfToday } = getTimeBoundaries();
    // Use formatDateLocal to avoid timezone conversion issues (toISOString converts to UTC)
    const todayStr = formatDateLocal(startOfToday);
    const yesterday = new Date(startOfToday);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateLocal(yesterday);
    const thirtyDaysAgo = new Date(startOfToday);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = formatDateLocal(thirtyDaysAgo);
    
    switch (segment) {
      case "UPCOMING":
        // Default from = startOfToday, to = empty (no upper limit)
        return {
          date_from: todayStr,
          date_to: undefined,
        };
      case "TODAY":
        // Fixed to today (no user date filters allowed)
        return {
          date_from: todayStr,
          date_to: todayStr,
        };
      case "PAST":
        // Default to = startOfToday (exclusive), from = empty OR 30 days ago
        return {
          date_from: thirtyDaysAgoStr, // Default to last 30 days
          date_to: yesterdayStr, // Exclusive boundary (before today)
        };
      case "ALL":
        // No date filters by default
        return {
          date_from: undefined,
          date_to: undefined,
        };
      default:
        return {
          date_from: undefined,
          date_to: undefined,
        };
    }
  }, [getTimeBoundaries, formatDateLocal]);

  // Use URL params for date filters if provided, otherwise use segment defaults
  const defaultDateFilters = getDefaultDateFiltersForSegment(initialSegment);
  
  const [statusFilter, setStatusFilter] = React.useState<string | string[]>(getInitialStatusFilter());
  // Appointments page only shows OPD appointments
  const [visitTypeFilter] = React.useState<string>("OPD");
  const [dateFromFilter, setDateFromFilter] = React.useState<string | undefined>(
    initialDateFrom || defaultDateFilters.date_from
  );
  const [dateToFilter, setDateToFilter] = React.useState<string | undefined>(
    initialDateTo || defaultDateFilters.date_to
  );
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  
  // Default sorting per segment (applied when segment changes if user hasn't manually sorted)
  const getDefaultSortForSegment = React.useCallback((segment: TimeSegment): { order: Order; orderBy: OrderBy } => {
    switch (segment) {
      case "UPCOMING":
        return { order: "asc", orderBy: "scheduled_at" }; // Soonest next
      case "TODAY":
        return { order: "asc", orderBy: "scheduled_at" }; // Soonest today
      case "PAST":
        return { order: "desc", orderBy: "scheduled_at" }; // Most recent past first
      case "ALL":
        return { order: "desc", orderBy: "scheduled_at" }; // Audit-friendly
      default:
        return { order: "desc", orderBy: "scheduled_at" };
    }
  }, []);

  const [order, setOrder] = React.useState<Order>(() => getDefaultSortForSegment("UPCOMING").order);
  const [orderBy, setOrderBy] = React.useState<OrderBy>(() => getDefaultSortForSegment("UPCOMING").orderBy);
  
  const [appointmentDialogOpen, setAppointmentDialogOpen] = React.useState(false);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = React.useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = React.useState<any>(null);
  const [rescheduleConfirmDialogOpen, setRescheduleConfirmDialogOpen] = React.useState(false);
  const [appointmentPendingReschedule, setAppointmentPendingReschedule] = React.useState<any>(null);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = React.useState(false);
  const [appointmentToReschedule, setAppointmentToReschedule] = React.useState<any>(null);
  const [prescriptionDialogOpen, setPrescriptionDialogOpen] = React.useState(false);
  const [prescriptionAppointmentId, setPrescriptionAppointmentId] = React.useState<string | null>(null);
  const [prescriptionPatientId, setPrescriptionPatientId] = React.useState<string | null>(null);
  const [prescriptionDetailOpen, setPrescriptionDetailOpen] = React.useState(false);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = React.useState<string | null>(null);
  const [closeVisitDialogOpen, setCloseVisitDialogOpen] = React.useState(false);
  const [appointmentToClose, setAppointmentToClose] = React.useState<Appointment | null>(null);
  
  // Helper function to format appointment ID
  const formatAppointmentId = (appointment: any): string => {
    if (!appointment?.id) return "";
    const isIPD = appointment.linked_ipd_admission_id;
    const prefix = isIPD ? "IPD" : "OPD";
    // Extract first 8 chars of tenant ID from patient code if available, otherwise use first 8 of appointment ID
    const tenantPrefix = appointment.patient_code?.split("-")[0] || appointment.id.replace(/-/g, "").substring(0, 8);
    // Use a simple sequence number based on appointment ID hash or use last part of ID
    const seq = appointment.id.replace(/-/g, "").substring(8, 12) || "00001";
    return `${tenantPrefix}-${prefix}-${seq.padStart(5, "0")}`;
  };

  //Helper function to display status filter
  type StatusFilterValue = string | string[];

  function StatusMultiSelect(props: {
    t: any;
    timeSegment: TimeSegment;
    statusFilter: StatusFilterValue;
    setStatusFilter: (v: StatusFilterValue) => void;
    setPage: (n: number) => void;
    showError: (msg: string) => void;
  }) {
    const { t, timeSegment, statusFilter, setStatusFilter, setPage, showError } = props;

    const [selectOpen, setSelectOpen] = React.useState(false);
    const isManualAllClickRef = React.useRef(false);

    // Get available statuses for current segment
    const availableStatuses =
      timeSegment === "UPCOMING" || timeSegment === "TODAY"
        ? ACTIVE_STATUSES
        : VALID_APPOINTMENT_STATUSES;

    const selectedStatuses: string[] = Array.isArray(statusFilter)
      ? statusFilter
      : statusFilter === "all"
      ? availableStatuses
      : [statusFilter];

    const allCount = availableStatuses.length;
    const selectedCount = selectedStatuses.length;

    const isAllSelected =
      selectedCount === allCount && selectedStatuses.every((s) => availableStatuses.includes(s));
    const isIndeterminate = selectedCount > 0 && selectedCount < allCount;

    const handleSelectAll = () => {
      isManualAllClickRef.current = true;

      if (timeSegment === "ALL") {
        setStatusFilter("all");
      } else {
        setStatusFilter(availableStatuses);
      }

      setPage(0);
      isManualAllClickRef.current = false;
    };

    const handleStatusChange = (incoming: string[]) => {
      if (incoming.length === 0) {
        showError(
          t("appointments.statusAtLeastOne", {
            defaultValue: "Select at least one status.",
          })
        );
        return;
      }

      const cleaned = incoming.filter((v) => availableStatuses.includes(v));

      if (cleaned.length === allCount) {
        if (timeSegment === "ALL") setStatusFilter("all");
        else setStatusFilter(availableStatuses);

        setPage(0);
        return;
      }

      setStatusFilter(cleaned);
      setPage(0);
    };

    return (
      <Select
        multiple
        open={selectOpen}
        onOpen={() => setSelectOpen(true)}
        onClose={() => setSelectOpen(false)}
        label={t("appointments.status", { defaultValue: "Status" })}
        value={selectedStatuses}
        onChange={(e) => {
          if (isManualAllClickRef.current) return;

          const raw = e.target.value;
          const incoming = (Array.isArray(raw) ? raw : [raw]) as string[];
          handleStatusChange(incoming);
        }}
        renderValue={(selected) => {
          const arr = (Array.isArray(selected) ? selected : []) as string[];
          const isAll = arr.length === allCount && arr.every((s) => availableStatuses.includes(s));

          if (isAll || statusFilter === "all") {
            return t("common.all", { defaultValue: "All" });
          }

          return t("common.nSelected", {
            defaultValue: "{{count}} selected",
            count: arr.length,
          });
        }}
        MenuProps={{
          PaperProps: {
            sx: { maxHeight: 360 },
          },
        }}
      >
        <MenuItem
          dense
          sx={{ py: 0.25 }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!isAllSelected) {
              handleSelectAll();
              return;
            }

            showError(
              t("appointments.cannotDeselectAll", {
                defaultValue:
                  "You cannot deselect all options. At least one status must be selected.",
              })
            );
          }}
        >
          <Checkbox checked={isAllSelected} indeterminate={isIndeterminate} size="small" sx={{ p: 0.5 }} />
          <ListItemText
            primary={t("common.all", { defaultValue: "All" })}
            primaryTypographyProps={{ variant: "body2" }}
          />
        </MenuItem>

        {availableStatuses.map((status) => (
          <MenuItem key={status} value={status} dense sx={{ py: 0.25 }}>
            <Checkbox checked={selectedStatuses.includes(status)} size="small" sx={{ p: 0.5 }} />
            <ListItemText primary={getAppointmentStatusLabel(status)} primaryTypographyProps={{ variant: "body2" }} />
          </MenuItem>
        ))}
      </Select>
    );
  }

  // Check for id parameter to open detail modal (only URL param we keep)
  React.useEffect(() => {
    const idParam = searchParams.get("id");
    if (idParam && idParam !== selectedAppointmentId) {
      setSelectedAppointmentId(idParam);
      setDetailOpen(true);
    }
  }, [searchParams, selectedAppointmentId]);

  // Track if we're initializing from URL params (to avoid resetting filters on first load)
  const isInitializingFromURL = React.useRef(
    !!(initialStatusFilterParam || initialDateFrom || initialDateTo || initialSearch || initialDoctorFilter !== "all" || initialDepartmentFilter !== "all")
  );
  
  // Keep user context filters across tabs, but reset time/status/page so tabs stay meaningful.
  // On tab change: preserve search text, rowsPerPage, and context filters (department/doctor).
  // Reset: dateFrom/dateTo, status filter, and sort (if not manually changed).
  // Exception: If we're initializing from URL params (dashboard navigation), preserve those filters.
  React.useEffect(() => {
    // On first load with URL params, don't reset filters - they're already set from URL
    if (isInitializingFromURL.current) {
      isInitializingFromURL.current = false;
      // Only set sort if not manually changed
      if (!hasManualSort) {
        const defaultSort = getDefaultSortForSegment(timeSegment);
        setOrder(defaultSort.order);
        setOrderBy(defaultSort.orderBy);
      }
      return;
    }
    
    // Reset sort to default if user hasn't manually changed it
    // If user has manually changed sort, keep it unless it conflicts (then fallback to tab default)
    if (!hasManualSort) {
      const defaultSort = getDefaultSortForSegment(timeSegment);
      setOrder(defaultSort.order);
      setOrderBy(defaultSort.orderBy);
    }
    // Reset status filter to segment default (only if not from URL)
    if (!initialStatusFilterParam) {
      const defaultStatus = getDefaultStatusFilterForSegment(timeSegment);
      setStatusFilter(defaultStatus);
    }
    // Reset date filters to segment defaults (only if not from URL)
    if (!initialDateFrom && !initialDateTo) {
      const defaultDates = getDefaultDateFiltersForSegment(timeSegment);
      setDateFromFilter(defaultDates.date_from);
      setDateToFilter(defaultDates.date_to);
    }
    // Note: search, rowsPerPage, doctorFilter, and departmentFilter are preserved across tab changes
  }, [timeSegment, hasManualSort, getDefaultSortForSegment, getDefaultStatusFilterForSegment, getDefaultDateFiltersForSegment]);

  // Auto-correct date filters to enforce segment constraints (prevents infinite loop by doing it in useEffect)
  React.useEffect(() => {
    const { startOfToday } = getTimeBoundaries();
    // Use formatDateLocal to avoid timezone conversion issues
    const todayStr = formatDateLocal(startOfToday);
    const yesterday = new Date(startOfToday);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateLocal(yesterday);
    
    if (timeSegment === "UPCOMING") {
      // Constraint: date_from must be >= startOfToday
      if (dateFromFilter && dateFromFilter < todayStr) {
        setDateFromFilter(todayStr);
      }
    } else if (timeSegment === "PAST") {
      // Constraint: date_to must be < startOfToday
      if (dateToFilter && dateToFilter >= todayStr) {
        setDateToFilter(yesterdayStr);
      }
    }
  }, [timeSegment, dateFromFilter, dateToFilter, getTimeBoundaries, formatDateLocal]);

  // Validate date range: date_to cannot be before date_from
  React.useEffect(() => {
    if (dateFromFilter && dateToFilter && dateToFilter < dateFromFilter) {
      // Auto-correct: set date_to to date_from if it's before
      setDateToFilter(dateFromFilter);
    }
  }, [dateFromFilter, dateToFilter]);

  // Reset page when search, filters, or sort change
  // Note: Segment change resets page in handleSegmentChange, but we include timeSegment here
  // to ensure page resets if segment changes through other means
  React.useEffect(() => {
    setPage(0);
  }, [timeSegment, debouncedSearch, doctorFilter, departmentFilter, statusFilter, visitTypeFilter, dateFromFilter, dateToFilter, order, orderBy]);

  // Debounce search - only search after 2 chars and 600ms delay
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (search.length >= 2 || search.length === 0) {
        setDebouncedSearch(search);
        setPage(0);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [search]);

  // Check permissions
  const canViewUsers = user ? can(user, "users:view") : false;
  const canViewDepartments = user ? can(user, "departments:view") : false;

  // Fetch doctors and departments for filters - only if user has permission
  const { data: doctors } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await apiClient.get("/users");
      return res.data.filter((u: any) => 
        u.roles?.some((r: any) => r.name === "DOCTOR")
      );
    },
    enabled: canViewUsers,
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await apiClient.get("/departments")).data,
    enabled: canViewDepartments,
  });


  // Calculate date filters based on time segment and user-provided date filters
  // Applies constraints to ensure segment meaning is preserved
  // NOTE: Do NOT call setState here - it causes infinite loops. Use useEffect for auto-correction.
  const { startOfToday, startOfTomorrow } = getTimeBoundaries();
  const getDateFiltersForSegment = React.useCallback((segment: TimeSegment, userDateFrom?: string, userDateTo?: string) => {
    // Use formatDateLocal to avoid timezone conversion issues
    const todayStr = formatDateLocal(startOfToday);
    const yesterday = new Date(startOfToday);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateLocal(yesterday);
    
    switch (segment) {
      case "UPCOMING":
        // For UPCOMING: scheduled_at >= startOfToday
        // Active status override (CHECKED_IN, IN_CONSULTATION) will be handled separately
        // Constraint: date_from must be >= startOfToday
        const fromDate = userDateFrom && userDateFrom >= todayStr ? userDateFrom : todayStr;
        return {
          date_from: fromDate,
          date_to: userDateTo, // No upper limit by default
        };
      case "TODAY":
        // For TODAY: scheduled_at is on today's date (fixed, no user date filters)
        // Backend uses func.date(Appointment.scheduled_at) >= date_from and <= date_to (both inclusive)
        return {
          date_from: todayStr,
          date_to: todayStr, // Same date for both to get only today's appointments
        };
      case "PAST":
        // For PAST: scheduled_at < startOfToday
        // Constraint: date_to must be < startOfToday
        const toDate = userDateTo && userDateTo < todayStr ? userDateTo : yesterdayStr;
        return {
          date_from: userDateFrom, // Can be empty or any past date
          date_to: toDate,
        };
      case "ALL":
        // For ALL: no constraints, use user-provided dates or none
        return {
          date_from: userDateFrom,
          date_to: userDateTo,
        };
      default:
        return {
          date_from: userDateFrom,
          date_to: userDateTo,
        };
    }
  }, [startOfToday, startOfTomorrow, formatDateLocal]);

  // Active status override for UPCOMING segment:
  // We need to fetch active appointments (CHECKED_IN, IN_CONSULTATION) regardless of scheduled date.
  // This ensures operational appointments never disappear from the default view even if their scheduled_at
  // has drifted into the past (e.g., a patient checked in late or consultation is running long).
  // Note: NO_SHOW is a terminal status (past outcome) and should NOT be included in this override.
  // Terminal statuses (COMPLETED, CANCELLED, NO_SHOW) are excluded from UPCOMING/TODAY because they
  // represent completed past outcomes and don't belong in operational views that show "what needs action now".
  const needsActiveStatusOverride = timeSegment === "UPCOMING";
  const activeStatusesForOverride = ["CHECKED_IN", "IN_CONSULTATION"]; // Only operational active statuses, not terminal

  // Additional query for active status appointments (only for UPCOMING segment)
  // Only enabled when UPCOMING segment is selected AND status filter includes active statuses or is "all"
  const shouldFetchActiveStatuses = needsActiveStatusOverride && (
    statusFilter === "all" || 
    (Array.isArray(statusFilter) && statusFilter.some(s => activeStatusesForOverride.includes(s))) ||
    (typeof statusFilter === "string" && statusFilter !== "all" && activeStatusesForOverride.includes(statusFilter))
  );

  // Main query for appointments based on segment
  const dateFilters = getDateFiltersForSegment(timeSegment, dateFromFilter, dateToFilter);
  // For UPCOMING segment with active status override, we need all data for client-side merge/pagination
  // For other segments, use server-side pagination
  const needsClientSidePagination = needsActiveStatusOverride && shouldFetchActiveStatuses;
  const { data: mainData, isLoading: mainLoading } = useQuery({
    queryKey: ["appointments", "main", debouncedSearch, doctorFilter, departmentFilter, statusFilter, visitTypeFilter, timeSegment, dateFilters.date_from, dateFilters.date_to, needsClientSidePagination ? "all" : page, needsClientSidePagination ? "all" : rowsPerPage],
    queryFn: async () => {
      const baseFilters: any = {
        search: debouncedSearch || undefined,
        doctor_user_id: doctorFilter !== "all" ? doctorFilter : undefined,
        department_id: departmentFilter !== "all" ? departmentFilter : undefined,
        visit_type: visitTypeFilter, // Always filter by OPD appointments
        // For UPCOMING with merge, fetch all data (up to backend limit) for client-side pagination
        // For other segments, use server-side pagination
        page: needsClientSidePagination ? 1 : page + 1,
        page_size: needsClientSidePagination ? 500 : rowsPerPage, // Backend max is 500
      };

      // Apply date filters
      if (dateFilters.date_from) baseFilters.date_from = dateFilters.date_from;
      if (dateFilters.date_to) baseFilters.date_to = dateFilters.date_to;

      // Apply status filter
      // When statusFilter is "all", don't send status filter to API (means all statuses)
      // For UPCOMING, we'll merge with active statuses separately, but still filter main query by status
      if (statusFilter !== "all") {
        const statusArray = Array.isArray(statusFilter) ? statusFilter : [statusFilter];
        if (statusArray.length > 0) {
          baseFilters.status = statusArray.join(",");
        }
      }
      // If statusFilter is "all", no status filter is applied (API returns all statuses)

      return fetchAppointments(baseFilters);
    },
    placeholderData: (previousData) => previousData,
  });

  const { data: activeData, isLoading: activeLoading } = useQuery({
    queryKey: ["appointments", "active", debouncedSearch, doctorFilter, departmentFilter, visitTypeFilter],
    queryFn: async () => {
      // Fetch active appointments (CHECKED_IN, IN_CONSULTATION) regardless of date
      // This ensures they appear in UPCOMING even if scheduled_at is in the past
      // Note: Only fetch operational active statuses, NOT terminal statuses like NO_SHOW
      const baseFilters: any = {
      search: debouncedSearch || undefined,
      doctor_user_id: doctorFilter !== "all" ? doctorFilter : undefined,
      department_id: departmentFilter !== "all" ? departmentFilter : undefined,
      visit_type: visitTypeFilter !== "all" ? visitTypeFilter : undefined,
        status: activeStatusesForOverride.join(","), // Only CHECKED_IN and IN_CONSULTATION
        // No date filters - we want all active appointments regardless of scheduled date
        page: 1,
        page_size: 500, // Maximum allowed by backend (backend limit is 500)
      };

      return fetchAppointments(baseFilters);
    },
    enabled: shouldFetchActiveStatuses,
    placeholderData: (previousData) => previousData,
    staleTime: 30000, // Cache for 30 seconds to prevent excessive refetching
    refetchOnWindowFocus: false, // Prevent refetching when window regains focus
  });

  // Merge and dedupe appointments for UPCOMING segment
  // Active status override: Include CHECKED_IN/IN_CONSULTATION appointments even if scheduled_at is in the past
  // This ensures operational appointments never disappear from the default view
  const { data, isLoading } = React.useMemo(() => {
    if (needsActiveStatusOverride && shouldFetchActiveStatuses) {
      const mainItems = mainData?.items ?? [];
      const activeItems = activeData?.items ?? [];
      
      // Create a map to dedupe by appointment ID
      const appointmentMap = new Map<string, any>();
      
      // Add main appointments first (scheduled_at >= startOfToday)
      mainItems.forEach((apt: any) => {
        appointmentMap.set(apt.id, apt);
      });
      
      // Add active appointments (CHECKED_IN, IN_CONSULTATION) regardless of date
      // This ensures they appear in UPCOMING even if scheduled_at is in the past
      // Note: NO_SHOW is terminal and should NOT appear in UPCOMING
      activeItems.forEach((apt: any) => {
        if (activeStatusesForOverride.includes(apt.status)) {
          appointmentMap.set(apt.id, apt);
        }
      });
      
      // Convert back to array
      let mergedItems = Array.from(appointmentMap.values());
      
      // Apply status filter if needed (client-side filtering after merge)
      if (statusFilter !== "all") {
        const statusArray = Array.isArray(statusFilter) ? statusFilter : [statusFilter];
        mergedItems = mergedItems.filter((apt: any) => statusArray.includes(apt.status));
      }
      
      // Apply sorting before pagination
      if (orderBy === "scheduled_at") {
        mergedItems.sort((a, b) => {
          const aDate = new Date(a.scheduled_at).getTime();
          const bDate = new Date(b.scheduled_at).getTime();
          return order === "asc" ? aDate - bDate : bDate - aDate;
        });
      } else if (orderBy === "patient_name") {
        mergedItems.sort((a, b) => {
          const aName = (a.patient_name || "").toLowerCase();
          const bName = (b.patient_name || "").toLowerCase();
          if (aName < bName) return order === "asc" ? -1 : 1;
          if (aName > bName) return order === "asc" ? 1 : -1;
          return 0;
        });
      }
      
      // Apply client-side pagination after sorting
      const startIndex = page * rowsPerPage;
      const endIndex = startIndex + rowsPerPage;
      const pagedItems = mergedItems.slice(startIndex, endIndex);
      
      // Calculate total
      const total = mergedItems.length;
      
      return {
        data: {
          items: pagedItems,
          total,
          page: page + 1,
          page_size: rowsPerPage,
        },
        isLoading: mainLoading || activeLoading,
      };
    }
    
    return {
      data: mainData,
      isLoading: mainLoading,
    };
  }, [needsActiveStatusOverride, shouldFetchActiveStatuses, mainData, activeData, mainLoading, activeLoading, statusFilter, page, rowsPerPage, activeStatusesForOverride, order, orderBy]);

  const { data: appointmentDetail } = useQuery({
    queryKey: ["appointment", selectedAppointmentId],
    queryFn: () => selectedAppointmentId ? getAppointment(selectedAppointmentId) : null,
    enabled: !!selectedAppointmentId && detailOpen,
  });

  // Fetch patient data for appointment detail
  useQuery({
    queryKey: ["patient", appointmentDetail?.patient_id],
    queryFn: async () => {
      if (!appointmentDetail?.patient_id) return null;
      const res = await apiClient.get(`/patients/${appointmentDetail.patient_id}`);
      return res.data;
    },
    enabled: !!appointmentDetail?.patient_id && detailOpen,
  });

  // Fetch prescription detail for viewing from appointment
  const { data: prescriptionDetailForView } = useQuery({
    queryKey: ["prescription", selectedPrescriptionId],
    queryFn: () => selectedPrescriptionId ? getPrescription(selectedPrescriptionId) : null,
    enabled: !!selectedPrescriptionId && prescriptionDetailOpen,
  });

  // Fetch patient data for prescription detail
  const { data: prescriptionPatientForView } = useQuery({
    queryKey: ["patient", prescriptionDetailForView?.patient_id],
    queryFn: async () => {
      if (!prescriptionDetailForView?.patient_id) return null;
      const res = await apiClient.get(`/patients/${prescriptionDetailForView.patient_id}`);
      return res.data;
    },
    enabled: !!prescriptionDetailForView?.patient_id && prescriptionDetailOpen,
  });

  // Fetch prescriptions for appointment detail
  useQuery({
    queryKey: ["prescriptions", "appointment", appointmentDetail?.id],
    queryFn: async () => {
      if (!appointmentDetail?.id) return [];
      const res = await apiClient.get("/prescriptions", {
        params: { appointment_id: appointmentDetail.id },
      });
      return res.data || [];
    },
    enabled: !!appointmentDetail?.id && detailOpen,
  });

  const closeDetail = () => {
    setDetailOpen(false);
    setSelectedAppointmentId(null);
  };

  // Mutations for appointment actions
  const checkInMutation = useMutation({
    mutationFn: checkInAppointment,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      const patientName = data?.patient_name || "Patient";
      const doctorName = data?.doctor_name || "Doctor";
      const scheduledAt = data?.scheduled_at 
        ? new Date(data.scheduled_at).toLocaleString()
        : "";
      showSuccess(
        t("appointments.checkInSuccessDetailed", {
          defaultValue: "{{name}} checked in successfully for appointment with {{doctor}} on {{date}}.",
          name: patientName,
          doctor: doctorName,
          date: scheduledAt,
        })
      );
    },
    onError: (error: any) => {
      const errorDetail = error?.response?.data?.detail || "";
      // Only show error if it's not a success (sometimes backend returns 200 but frontend sees error)
      if (errorDetail && !errorDetail.includes("successfully")) {
        showError(errorDetail || t("appointments.checkInError", { defaultValue: "Failed to check in patient" }));
      }
    },
  });

  const startConsultationMutation = useMutation({
    mutationFn: startConsultation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      const patientName = data?.patient_name || "Patient";
      const scheduledAt = data?.scheduled_at 
        ? new Date(data.scheduled_at).toLocaleString()
        : "";
      showSuccess(
        t("appointments.consultationStartedDetailed", { 
          defaultValue: "Consultation started for {{name}} (Appointment: {{date}}).",
          name: patientName,
          date: scheduledAt
        })
      );
    },
    onError: (error: any) => {
      showError(error?.response?.data?.detail || t("appointments.consultationStartError", { defaultValue: "Failed to start consultation" }));
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, withRx, closureNote }: { id: string; withRx: boolean; closureNote?: string }) =>
      completeAppointment(id, withRx, closureNote),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      const patientName = data?.patient_name || "Patient";
      const scheduledAt = data?.scheduled_at 
        ? new Date(data.scheduled_at).toLocaleString()
        : "";
      const withRxText = data?.with_rx ? t("appointments.withPrescription", { defaultValue: " with prescription" }) : "";
      showSuccess(
        t("appointments.completeSuccessDetailed", { 
          defaultValue: "Appointment completed for {{name}} ({{date}}){{rx}}. Email notification sent.",
          name: patientName,
          date: scheduledAt,
          rx: withRxText
        })
      );
    },
    onError: (error: any) => {
      showError(error?.response?.data?.detail || t("appointments.completeError", { defaultValue: "Failed to complete appointment" }));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason, note }: { id: string; reason: string; note?: string }) =>
      cancelAppointment(id, reason, note),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setCancelDialogOpen(false);
      setAppointmentToCancel(null);
      const patientName = data?.patient_name || appointmentToCancel?.patient_name || "Patient";
      const scheduledAt = data?.scheduled_at || appointmentToCancel?.scheduled_at
        ? new Date(data?.scheduled_at || appointmentToCancel?.scheduled_at).toLocaleString()
        : "";
      showSuccess(
        t("appointments.cancelSuccessDetailed", { 
          defaultValue: "Appointment cancelled for {{name}} ({{date}}). Email notification sent.",
          name: patientName,
          date: scheduledAt
        })
      );
    },
    onError: (error: any) => {
      showError(error?.response?.data?.detail || t("appointments.cancelError", { defaultValue: "Failed to cancel appointment" }));
    },
  });

  const noShowMutation = useMutation({
    mutationFn: markNoShow,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      const patientName = data?.patient_name || "Patient";
      showSuccess(
        t("appointments.noShowMarkedWithPatient", { 
          defaultValue: "Appointment marked as no-show for {{name}}",
          name: patientName
        })
      );
    },
    onError: (error: any) => {
      showError(error?.response?.data?.detail || t("appointments.noShowError", { defaultValue: "Failed to mark as no-show" }));
    },
  });

  // Reschedule mutation - child component (RescheduleAppointmentForm) handles API call and success toast
  // Parent only needs to close dialog and refresh data
  const rescheduleMutation = useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) =>
      rescheduleAppointment(id, scheduledAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setRescheduleDialogOpen(false);
      setAppointmentToReschedule(null);
      // Success toast is shown in RescheduleAppointmentForm (child component)
    },
    onError: (error: any) => {
      showError(error?.response?.data?.detail || t("appointments.rescheduleError", { defaultValue: "Failed to reschedule appointment" }));
    },
  });

  // Batch fetch active admissions for all unique patients in the appointments list
  const uniquePatientIds = React.useMemo(() => {
    const items = data?.items ?? [];
    return Array.from(new Set(items.map((a: Appointment) => a.patient_id).filter(Boolean)));
  }, [data?.items]);

  const { data: activeAdmissionsMap } = useQuery({
    queryKey: ["admissions", "active", "batch", uniquePatientIds.join(",")],
    queryFn: async () => {
      if (uniquePatientIds.length === 0) return {};
      try {
        const admissionsByPatient: Record<string, boolean> = {};
        // Fetch active admissions for each patient (could be optimized with a batch endpoint)
        await Promise.all(
          uniquePatientIds.map(async (patientId) => {
            try {
              const res = await apiClient.get("/admissions", {
                params: { patient_id: patientId, status: "ACTIVE" },
              });
              admissionsByPatient[patientId] = (res.data || []).length > 0;
            } catch {
              admissionsByPatient[patientId] = false;
            }
          })
        );
        return admissionsByPatient;
      } catch {
        return {};
      }
    },
    enabled: uniquePatientIds.length > 0,
  });

  // For UPCOMING segment with merge, data.items is already sorted and paginated client-side
  // For other segments, apply client-side sorting if needed (server returns unsorted or differently sorted)
  const appointments = React.useMemo(() => {
    const items = data?.items ?? [];
    // If data is already paginated client-side (UPCOMING merge), don't sort again (already sorted)
    if (needsClientSidePagination) {
      // Already sorted and paginated in the merge logic above
      return items;
    }
    // For server-side paginated segments, apply sorting
    if (orderBy === "scheduled_at") {
      return [...items].sort((a, b) => {
        const aDate = new Date(a.scheduled_at).getTime();
        const bDate = new Date(b.scheduled_at).getTime();
        return order === "asc" ? aDate - bDate : bDate - aDate;
      });
    } else if (orderBy === "patient_name") {
      return [...items].sort((a, b) => {
        const aName = (a.patient_name || "").toLowerCase();
        const bName = (b.patient_name || "").toLowerCase();
        if (aName < bName) return order === "asc" ? -1 : 1;
        if (aName > bName) return order === "asc" ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [data?.items, order, orderBy, needsClientSidePagination]);
  const totalCount = data?.total || 0;

  const handleSearchChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setSearch(event.target.value);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
  };

  const handleSegmentChange = (_event: React.SyntheticEvent, newValue: TimeSegment) => {
    setTimeSegment(newValue);
    setPage(0); // Always reset to first page on tab change
    // Reset manual sort flag so default sort applies (unless user manually changed it)
    // Note: search, rowsPerPage, doctorFilter, and departmentFilter are preserved
    // Status and date filters will be reset by the useEffect hook
  };

  const canCreate = can(user, "appointments:create");
  
  // Get user roles for action button visibility
  const userRoles = user?.roles?.map((r: any) => r.name) || [];
  const isDoctor = userRoles.includes("DOCTOR");
  const isReceptionist = userRoles.includes("RECEPTIONIST");
  const isAdmin = userRoles.includes("HOSPITAL_ADMIN") || userRoles.includes("SUPER_ADMIN");

  return (
    <Box>
      <PageToolbar
        title={t("appointments.title", { defaultValue: "Appointments" })}
        subtitle={t("appointments.subtitle", {
          defaultValue: "Schedule and manage patient appointments across departments.",
        })}
        titleIcon={<EventIcon sx={{ fontSize: 32 }} />}
        primaryAction={
          canCreate
            ? {
                label: t("appointments.create", { defaultValue: "Create Appointment" }),
                onClick: () => setAppointmentDialogOpen(true), // Directly open OPD appointment dialog
                icon: <AddIcon />,
              }
            : undefined
        }
      />
      {/* Time Segment Tabs */}
      <Paper elevation={1} sx={{ mb: 2, borderRadius: 2 }}>
        <Tabs
          value={timeSegment}
          onChange={handleSegmentChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            "& .MuiTab-root": {
              minHeight: 48,
              textTransform: "none",
              fontWeight: 500,
            },
          }}
        >
          <Tab
            label={t("appointments.segment.upcoming", { defaultValue: "Upcoming" })}
            value="UPCOMING"
          />
          <Tab
            label={t("appointments.segment.today", { defaultValue: "Today" })}
            value="TODAY"
          />
          <Tab
            label={t("appointments.segment.past", { defaultValue: "Past" })}
            value="PAST"
          />
          <Tab
            label={t("appointments.segment.all", { defaultValue: "All" })}
            value="ALL"
          />
        </Tabs>
      </Paper>

      {/* Filters */}
      <Paper elevation={1} sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12 }}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <TextField
              fullWidth
              size="small"
              placeholder={t("appointments.searchPlaceholder", { defaultValue: "Search by patient or doctor" })}
              value={search}
              onChange={(e) => handleSearchChange(e)}
            />
              {/* "Search in All" button - show when search has no results and segment is not ALL */}
              {debouncedSearch && 
               debouncedSearch.length >= 2 && 
               timeSegment !== "ALL" && 
               data?.items?.length === 0 && 
               !isLoading && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setTimeSegment("ALL");
                    setHasManualSort(false);
                    setPage(0);
                  }}
                  sx={{ whiteSpace: "nowrap", minWidth: "auto" }}
                >
                  {t("appointments.searchInAll", { defaultValue: "Search in All" })}
                </Button>
              )}
            </Box>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Divider />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>{t("appointments.department", { defaultValue: "Department" })}</InputLabel>
              <Select
                value={departmentFilter}
                label={t("appointments.department", { defaultValue: "Department" })}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setDepartmentFilter(newValue);
                  setPage(0);
                }}
              >
                <MenuItem value="all">{t("common.all", { defaultValue: "All" })}</MenuItem>
                {departments?.map((dept: any) => (
                  <MenuItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>{t("appointments.doctor", { defaultValue: "Doctor" })}</InputLabel>
              <Select
                value={doctorFilter}
                label={t("appointments.doctor", { defaultValue: "Doctor" })}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setDoctorFilter(newValue);
                  setPage(0);
                }}
              >
                <MenuItem value="all">{t("common.all", { defaultValue: "All" })}</MenuItem>
                {doctors?.map((doctor: any) => (
                  <MenuItem key={doctor.id} value={doctor.id}>
                    {`${doctor.first_name} ${doctor.last_name}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl
              fullWidth
              size="small"
              sx={{
                maxWidth: { xs: "100%", sm: 260, md: 220 }, // reduce width
              }}
            >
              <InputLabel>
                {t("appointments.status", { defaultValue: "Status" })}
              </InputLabel>

              <StatusMultiSelect
                t={t}
                timeSegment={timeSegment}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                setPage={setPage}
                showError={showError}
              />
            </FormControl>
          </Grid>

          {/* Date filters - disabled for TODAY, enabled for others */}
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label={t("appointments.dateFrom", { defaultValue: "Date From" })}
              value={dateFromFilter || ""}
              onChange={(e) => {
                const newValue = e.target.value || undefined;
                setDateFromFilter(newValue);
                setPage(0);
              }}
              InputLabelProps={{ shrink: true }}
              disabled={timeSegment === "TODAY"}
              error={!!(dateFromFilter && dateToFilter && dateToFilter < dateFromFilter)}
              helperText={dateFromFilter && dateToFilter && dateToFilter < dateFromFilter 
                ? t("appointments.dateToBeforeFrom", { defaultValue: "Date To cannot be before Date From" })
                : ""}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label={t("appointments.dateTo", { defaultValue: "Date To" })}
              value={dateToFilter || ""}
              onChange={(e) => {
                const newValue = e.target.value || undefined;
                // Validate: date_to cannot be before date_from
                if (dateFromFilter && newValue && newValue < dateFromFilter) {
                  showError(
                    t("appointments.dateToBeforeFrom", { defaultValue: "Date To cannot be before Date From" })
                  );
                  return;
                }
                setDateToFilter(newValue);
                setPage(0);
              }}
              InputLabelProps={{ shrink: true }}
              disabled={timeSegment === "TODAY"}
              error={!!(dateFromFilter && dateToFilter && dateToFilter < dateFromFilter)}
              helperText={dateFromFilter && dateToFilter && dateToFilter < dateFromFilter 
                ? t("appointments.dateToBeforeFrom", { defaultValue: "Date To cannot be before Date From" })
                : ""}
            />
          </Grid>

        </Grid>
      </Paper>
      <Paper
        elevation={2}
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          border: "1px solid rgba(0, 0, 0, 0.05)",
        }}
      >
        {isLoading ? (
          <Box sx={{ py: 6, textAlign: "center" }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {appointments.some(a => a.id) && (
                      <TableCell>
                        {t("appointments.appointmentId", { defaultValue: "ID" })}
                      </TableCell>
                    )}
                    <TableCell>
                      {t("appointments.patient", { defaultValue: "Patient" })}
                    </TableCell>
                    <TableCell>
                      {t("appointments.doctor", { defaultValue: "Doctor" })}
                    </TableCell>
                    <TableCell>
                      {t("appointments.department", { defaultValue: "Department" })}
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={orderBy === "scheduled_at"}
                        direction={orderBy === "scheduled_at" ? order : "asc"}
                        onClick={() => {
                          const isAsc = orderBy === "scheduled_at" && order === "asc";
                          setOrder(isAsc ? "desc" : "asc");
                          setOrderBy("scheduled_at");
                          setHasManualSort(true);
                        }}
                      >
                        {t("appointments.scheduledAt", { defaultValue: "Scheduled At" })}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      {t("appointments.status", { defaultValue: "Status" })}
                    </TableCell>
                    <TableCell align="center">
                      {t("appointments.rx", { defaultValue: "Rx" })}
                    </TableCell>
                    <TableCell align="right">
                      {t("common.actions", { defaultValue: "Actions" })}
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {appointments.map((a: Appointment) => {
                    const scheduledDate = new Date(a.scheduled_at || (a as any).appointment_date);
                    
                    // Check if appointment is eligible for prescription
                    const isEligible = isEligibleOPD(a);
                    
                    // Determine which actions are available based on role, status, and eligibility
                    const canCheckInAppt = (isReceptionist || isAdmin || isDoctor) && canCheckIn(a);
                    const canStartConsultation = (isDoctor || isAdmin) && (a.status === "SCHEDULED" || a.status === "CHECKED_IN");
                    // Check if prescription already exists
                    const hasExistingPrescription = a.prescription_status || a.prescription_count > 0 || a.has_prescription;
                    const hasDraftPrescription = a.prescription_status === "DRAFT";
                    // Admins can write prescriptions even without DOCTOR role (they have all permissions)
                    const canWritePrescription = (isDoctor || isAdmin) && isEligible && can(user, "prescriptions:create") && !hasExistingPrescription;
                    const canViewPrescription = hasExistingPrescription;
                    const canCloseNoRx = (isDoctor || isAdmin) && canCloseVisit(a) && !hasDraftPrescription;
                    const canRescheduleAppt = (isReceptionist || isAdmin) && canReschedule(a);
                    const canCancelAppt = (isReceptionist || isAdmin) && canCancel(a);
                    const canMarkNoShow = (isReceptionist || isAdmin) && shouldMarkNoShow(a);
                    
                    return (
                      <TableRow 
                        key={a.id} 
                        hover
                        onClick={() => {
                          setSelectedAppointmentId(a.id);
                          setDetailOpen(true);
                        }}
                        sx={{ cursor: "pointer" }}
                      >
                        {appointments.some(apt => apt.id) && (
                          <TableCell>
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                              {formatAppointmentId(a)}
                            </Typography>
                          </TableCell>
                        )}
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              {a.patient_name || "-"}
                            </Typography>
                            {a.patient_code && (
                              <Typography variant="caption" color="text.secondary">
                                {a.patient_code}
                              </Typography>
                            )}
                            <Box sx={{ mt: 0.5, display: "flex", gap: 0.5 }}>
                              {activeAdmissionsMap?.[a.patient_id] ? (
                                <Chip
                                  label="IPD"
                                  size="small"
                                  color="primary"
                                  sx={{ height: 18, fontSize: "0.65rem" }}
                                />
                              ) : (
                                <Chip
                                  label="OPD"
                                  size="small"
                                  color="info"
                                  sx={{ height: 18, fontSize: "0.65rem" }}
                                />
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>{a.doctor_name || "-"}</TableCell>
                        <TableCell>{a.department || "-"}</TableCell>
                        <TableCell>
                          {scheduledDate.toLocaleString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getAppointmentStatusLabel(a.status)}
                            size="small"
                            color={getAppointmentStatusColor(a.status)}
                            sx={{ borderRadius: 2 }}
                          />
                        </TableCell>
                        <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                          {a.prescription_status ? (
                            <Chip
                              label={t(`prescriptions.status.${a.prescription_status}`, { defaultValue: a.prescription_status })}
                              size="small"
                              color={
                                a.prescription_status === "ISSUED"
                                  ? "success"
                                  : a.prescription_status === "DISPENSED"
                                  ? "info"
                                  : a.prescription_status === "CANCELLED"
                                  ? "default"
                                  : "warning"
                              }
                              sx={{ borderRadius: 2, cursor: "pointer" }}
                              onClick={() => {
                                navigate(`/prescriptions?appointment_id=${a.id}`);
                              }}
                            />
                          ) : a.prescription_count && a.prescription_count > 0 ? (
                            <Chip
                              label={`Rx (${a.prescription_count})`}
                              size="small"
                              color="success"
                              sx={{ borderRadius: 2, cursor: "pointer" }}
                              onClick={() => {
                                navigate(`/prescriptions?appointment_id=${a.id}`);
                              }}
                            />
                          ) : a.has_prescription ? (
                            <Chip
                              label="Rx"
                              size="small"
                              color="success"
                              sx={{ borderRadius: 2, cursor: "pointer" }}
                              onClick={() => {
                                navigate(`/prescriptions?appointment_id=${a.id}`);
                              }}
                            />
                          ) : (
                            <Typography variant="caption" color="text.secondary">-</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            // Collect all available actions in order
                            const allActions: Array<{ key: string; element: React.ReactNode }> = [];
                            
                            // Always include View Details
                            allActions.push({
                              key: "view",
                              element: (
                                <Tooltip key="view" title={t("common.view", { defaultValue: "View Details" })}>
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setSelectedAppointmentId(a.id);
                                      setDetailOpen(true);
                                    }}
                                  >
                                    <VisibilityIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              ),
                            });
                            
                            // Workflow actions
                            if (canCheckInAppt) {
                              allActions.push({
                                key: "checkin",
                                element: (
                                  <Tooltip key="checkin" title={t("appointments.checkIn", { defaultValue: "Check In" })}>
                                    <IconButton
                                      size="small"
                                      color="info"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        checkInMutation.mutate(a.id);
                                      }}
                                    >
                                      <CheckCircleIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                ),
                              });
                            }
                            
                            if (canStartConsultation) {
                              allActions.push({
                                key: "start",
                                element: (
                                  <Tooltip key="start" title={t("appointments.startConsultation", { defaultValue: "Start Consultation" })}>
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      onClick={() => {
                                        startConsultationMutation.mutate(a.id);
                                      }}
                                    >
                                      <PlayArrowIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                ),
                              });
                            }
                            
                            if (canWritePrescription) {
                              allActions.push({
                                key: "writeRx",
                                element: (
                                  <Tooltip key="writeRx" title={t("appointments.writePrescription", { defaultValue: "Write Prescription" })}>
                                    <IconButton
                                      size="small"
                                      color="success"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPrescriptionPatientId(a.patient_id);
                                        setPrescriptionAppointmentId(a.id);
                                        setPrescriptionDialogOpen(true);
                                      }}
                                    >
                                      <LocalPharmacyIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                ),
                              });
                            }
                            
                            if (canViewPrescription) {
                              allActions.push({
                                key: "viewRx",
                                element: (
                                  <Tooltip key="viewRx" title={t("appointments.viewPrescription", { defaultValue: "View Prescription" })}>
                                    <IconButton
                                      size="small"
                                      color="info"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/prescriptions?appointment_id=${a.id}`);
                                      }}
                                    >
                                      <LocalPharmacyIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                ),
                              });
                            }
                            
                            if (canCloseNoRx) {
                              allActions.push({
                                key: "complete",
                                element: (
                                  <Tooltip 
                                    key="complete"
                                    title={
                                      hasDraftPrescription 
                                        ? t("appointments.cannotCompleteWithDraftRx", { defaultValue: "Cannot complete appointment while a draft prescription exists. Please issue or cancel the prescription first." })
                                        : t("appointments.closeNoRx", { defaultValue: "Close Visit (No Rx)" })
                                    }
                                  >
                                    <span>
                                      <IconButton
                                        size="small"
                                        color="success"
                                        disabled={hasDraftPrescription}
                                        onClick={() => {
                                          setAppointmentToClose(a);
                                          setCloseVisitDialogOpen(true);
                                        }}
                                      >
                                        <CheckCircleIcon fontSize="small" />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                ),
                              });
                            }
                            
                            // Administrative actions
                            if (canRescheduleAppt) {
                              allActions.push({
                                key: "reschedule",
                                element: (
                                  <Tooltip key="reschedule" title={t("appointments.reschedule", { defaultValue: "Reschedule" })}>
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (a.status === "CHECKED_IN") {
                                          setAppointmentPendingReschedule(a);
                                          setRescheduleConfirmDialogOpen(true);
                                        } else {
                                          setAppointmentToReschedule(a);
                                          setRescheduleDialogOpen(true);
                                        }
                                      }}
                                    >
                                      <ScheduleIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                ),
                              });
                            }
                            
                            if (canCancelAppt) {
                              allActions.push({
                                key: "cancel",
                                element: (
                                  <Tooltip key="cancel" title={t("appointments.cancel", { defaultValue: "Cancel" })}>
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAppointmentToCancel(a);
                                        setCancelDialogOpen(true);
                                      }}
                                    >
                                      <CancelIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                ),
                              });
                            }
                            
                            if (canMarkNoShow) {
                              allActions.push({
                                key: "noshow",
                                element: (
                                  <Tooltip key="noshow" title={t("appointments.markNoShow", { defaultValue: "Mark No-Show" })}>
                                    <IconButton
                                      size="small"
                                      color="warning"
                                      onClick={() => {
                                        if (window.confirm(t("appointments.markNoShowConfirm", { 
                                          defaultValue: "Mark as no-show?" 
                                        }))) {
                                          noShowMutation.mutate(a.id);
                                        }
                                      }}
                                    >
                                      <CancelIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                ),
                              });
                            }
                            
                            const totalActions = allActions.length;
                            
                            // Determine distribution based on total count
                            let line1Count = totalActions;
                            
                            if (totalActions > 3) {
                              if (totalActions === 4) {
                                line1Count = 2;
                              } else if (totalActions === 5) {
                                line1Count = 3;
                              } else {
                                // 6 or more: 3 in first line
                                line1Count = 3;
                              }
                            }
                            
                            const line1Actions = allActions.slice(0, line1Count);
                            const line2Actions = totalActions > line1Count ? allActions.slice(line1Count) : [];
                            
                            return (
                              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, alignItems: "flex-end" }}>
                                {/* Line 1 */}
                                <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                                  {line1Actions.map(action => action.element)}
                                </Box>
                                
                                {/* Line 2 */}
                                {line2Actions.length > 0 && (
                                  <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                                    {line2Actions.map(action => action.element)}
                                  </Box>
                                )}
                              </Box>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {appointments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                        <EmptyIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2, opacity: 0.5 }} />
                        <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                          {t("appointments.empty", { defaultValue: "No appointments found" })}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t("appointments.emptyDescription", {
                            defaultValue: search
                              ? "Try adjusting your search criteria."
                              : "Get started by creating your first appointment.",
                          })}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={totalCount}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 20, 50, 100]}
            />
          </>
        )}
      </Paper>
      <AppointmentFormDialog
        open={appointmentDialogOpen}
        onClose={() => setAppointmentDialogOpen(false)}
        onCreated={() => {
          setAppointmentDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
        }}
      />
      {/* Appointment Detail Dialog */}
      <AppointmentDetailDialog
        open={detailOpen}
        appointmentId={selectedAppointmentId}
        onClose={closeDetail}
        onViewPrescription={(prescriptionId) => {
          setSelectedPrescriptionId(prescriptionId);
          setPrescriptionDetailOpen(true);
        }}
      />
      
      {/* Cancel Appointment Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => {
        setCancelDialogOpen(false);
        setAppointmentToCancel(null);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>
          {t("appointments.cancelAppointment", { defaultValue: "Cancel Appointment" })}
        </DialogTitle>
        <DialogContent>
          <CancelAppointmentForm
            appointment={appointmentToCancel}
            onCancel={(reason, note) => {
              if (appointmentToCancel) {
                cancelMutation.mutate({
                  id: appointmentToCancel.id,
                  reason,
                  note,
                });
              }
            }}
            onClose={() => {
              setCancelDialogOpen(false);
              setAppointmentToCancel(null);
            }}
          />
        </DialogContent>
      </Dialog>
      
      {/* Reschedule Confirmation Dialog (for checked-in appointments) */}
      <Dialog open={rescheduleConfirmDialogOpen} onClose={() => {
        setRescheduleConfirmDialogOpen(false);
        setAppointmentPendingReschedule(null);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>
          {t("appointments.reschedule", { defaultValue: "Reschedule Appointment" })}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {t("appointments.rescheduleCheckedInConfirm", {
              defaultValue: "Rescheduling will remove patient from queue. Continue?",
            })}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ pr: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setRescheduleConfirmDialogOpen(false);
              setAppointmentPendingReschedule(null);
            }}
            color="inherit"
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            onClick={() => {
              setAppointmentToReschedule(appointmentPendingReschedule);
              setRescheduleConfirmDialogOpen(false);
              setAppointmentPendingReschedule(null);
              setRescheduleDialogOpen(true);
            }}
            variant="contained"
            color="primary"
          >
            {t("common.yes", { defaultValue: "Yes" })}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Reschedule Appointment Dialog */}
      <Dialog open={rescheduleDialogOpen} onClose={() => {
        setRescheduleDialogOpen(false);
        setAppointmentToReschedule(null);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>
          {t("appointments.rescheduleAppointment", { defaultValue: "Reschedule Appointment" })}
        </DialogTitle>
        <DialogContent>
          <RescheduleAppointmentForm
            appointment={appointmentToReschedule}
            onReschedule={(scheduledAt) => {
              // Child component already handled API call and showed success toast
              // Parent only needs to close dialog and refresh data
              if (appointmentToReschedule) {
                rescheduleMutation.mutate({
                  id: appointmentToReschedule.id,
                  scheduledAt,
                });
              }
            }}
            onClose={() => {
              setRescheduleDialogOpen(false);
              setAppointmentToReschedule(null);
            }}
          />
        </DialogContent>
      </Dialog>
      
      {/* Prescription Form Dialog */}
      <PrescriptionFormDialog
        open={prescriptionDialogOpen}
        onClose={() => {
          setPrescriptionDialogOpen(false);
          setPrescriptionAppointmentId(null);
          setPrescriptionPatientId(null);
        }}
        onCreated={() => {
          // Child dialog (PrescriptionFormDialog) already showed success toast
          // Parent only needs to close dialog and refresh data
          setPrescriptionDialogOpen(false);
          setPrescriptionAppointmentId(null);
          setPrescriptionPatientId(null);
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
          queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
        }}
        initialPatientId={prescriptionPatientId || undefined}
        initialAppointmentId={prescriptionAppointmentId || undefined}
      />

      {/* Prescription Detail Dialog (for viewing from appointment) */}
      <Dialog 
        open={prescriptionDetailOpen} 
        onClose={() => { 
          setPrescriptionDetailOpen(false); 
          setSelectedPrescriptionId(null); 
        }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="h6">
              {t("prescriptions.details", { defaultValue: "Prescription Details" })}
              {prescriptionDetailForView?.prescription_code && (
                <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  (ID: {prescriptionDetailForView.prescription_code})
                </Typography>
              )}
            </Typography>
            <IconButton 
              onClick={() => { 
                setPrescriptionDetailOpen(false); 
                setSelectedPrescriptionId(null); 
              }} 
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {prescriptionDetailForView && (
            <>
              <Divider sx={{ mb: 2, mt: 1 }} />
              <Grid container spacing={3}>
                {/* Patient Information */}
                <Grid size={{ xs: 12 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      {t("prescriptions.patientInfo", { defaultValue: "Patient Information" })}
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t("prescriptions.patient", { defaultValue: "Patient" })}
                        </Typography>
                        <Typography variant="body1" fontWeight={500}>
                          {prescriptionDetailForView.patient_name || prescriptionPatientForView?.first_name ? `${prescriptionPatientForView?.first_name || ""} ${prescriptionPatientForView?.last_name || ""}`.trim() || "-" : "-"}
                          {prescriptionPatientForView?.patient_code && (
                            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                              ({prescriptionPatientForView.patient_code})
                            </Typography>
                          )}
                        </Typography>
                      </Grid>
                      {prescriptionPatientForView?.gender && (
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant="caption" color="text.secondary">
                            {t("patients.gender", { defaultValue: "Gender" })}
                          </Typography>
                          <Typography variant="body1">
                            {prescriptionPatientForView.gender.charAt(0).toUpperCase() + prescriptionPatientForView.gender.slice(1).toLowerCase()}
                          </Typography>
                        </Grid>
                      )}
                      {prescriptionPatientForView && (
                        <>
                          {(prescriptionPatientForView.phone_primary || prescriptionPatientForView.email) && (
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Typography variant="caption" color="text.secondary">
                                {t("patients.contact", { defaultValue: "Contact" })}
                              </Typography>
                              <Typography variant="body1">
                                {prescriptionPatientForView.phone_primary && (
                                  <>
                                    {t("patients.phone", { defaultValue: "Phone" })}: {prescriptionPatientForView.phone_primary}
                                  </>
                                )}
                                {prescriptionPatientForView.phone_primary && prescriptionPatientForView.email && " • "}
                                {prescriptionPatientForView.email && (
                                  <>
                                    {t("patients.email", { defaultValue: "Email" })}: {prescriptionPatientForView.email}
                                  </>
                                )}
                              </Typography>
                            </Grid>
                          )}
                          {(prescriptionPatientForView.city || prescriptionPatientForView.state) && (
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Typography variant="caption" color="text.secondary">
                                {t("patients.address", { defaultValue: "Address" })}
                              </Typography>
                              <Typography variant="body1">
                                {prescriptionPatientForView.state 
                                  ? `${prescriptionPatientForView.city || ""}, ${prescriptionPatientForView.state}`.replace(/^,\s*|,\s*$/g, '')
                                  : prescriptionPatientForView.city || "-"}
                              </Typography>
                            </Grid>
                          )}
                        </>
                      )}
                    </Grid>
                  </Paper>
                </Grid>

                {/* Prescription Detail */}
                <Grid size={{ xs: 12 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      {t("prescriptions.prescriptionInformation", { defaultValue: "Prescription Information" })}
                      {" "}
                      <Chip
                        label={getPrescriptionStatusLabel(prescriptionDetailForView.status)}
                        size="small"
                        color={getPrescriptionStatusColor(prescriptionDetailForView.status)}
                        sx={{ borderRadius: 2, ml: 1 }}
                      />
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                      {prescriptionDetailForView.doctor_name && (
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant="caption" color="text.secondary">
                            {t("prescriptions.doctor", { defaultValue: "Doctor" })}
                          </Typography>
                          <Typography variant="body1">{prescriptionDetailForView.doctor_name}</Typography>
                        </Grid>
                      )}
                      {prescriptionDetailForView.visit_type && (
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant="caption" color="text.secondary">
                            {t("prescriptions.visitType", { defaultValue: "Visit Type" })}
                          </Typography>
                          <Typography variant="body1">{prescriptionDetailForView.visit_type}</Typography>
                        </Grid>
                      )}
                      {prescriptionDetailForView.chief_complaint && (
                        <Grid size={{ xs: 12 }}>
                          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                            {t("prescriptions.chiefComplaint", { defaultValue: "Chief Complaint / Patient Notes" })}
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                            {prescriptionDetailForView.chief_complaint}
                          </Typography>
                        </Grid>
                      )}
                      {prescriptionDetailForView.diagnosis && (
                        <Grid size={{ xs: 12 }}>
                          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                            {t("prescriptions.diagnosis", { defaultValue: "Diagnosis" })}
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                            {prescriptionDetailForView.diagnosis}
                          </Typography>
                        </Grid>
                      )}
                      {prescriptionDetailForView.items && prescriptionDetailForView.items.length > 0 && (
                        <Grid size={{ xs: 12 }}>
                          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                            {t("prescriptions.medicines", { defaultValue: "Medicines" })}
                          </Typography>
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            {prescriptionDetailForView.items.map((item: any, idx: number) => (
                              <Paper key={idx} elevation={1} sx={{ p: 1.5, borderRadius: 2 }}>
                                <Typography variant="body2" fontWeight={500}>
                                  {idx + 1}. {item.medicine_name}
                                </Typography>
                                {(item.dosage || item.frequency || item.duration) && (
                                  <Typography variant="caption" color="text.secondary">
                                    {[item.dosage, item.frequency, item.duration].filter(Boolean).join(" • ")}
                                  </Typography>
                                )}
                                {item.instructions && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                                    {t("prescriptions.instructions", { defaultValue: "Instructions" })}: {item.instructions}
                                  </Typography>
                                )}
                              </Paper>
                            ))}
                          </Box>
                        </Grid>
                      )}
                    </Grid>
                  </Paper>
                </Grid>

                {/* Audit Information */}
                {(prescriptionDetailForView.created_at || (prescriptionDetailForView as any).issued_at || (prescriptionDetailForView as any).dispensed_at || (prescriptionDetailForView as any).updated_at) && (
                  <Grid size={{ xs: 12 }}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        {t("prescriptions.auditInfo", { defaultValue: "Audit Information" })}
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Grid container spacing={2}>
                        {prescriptionDetailForView.created_at && (
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="caption" color="text.secondary">
                              {t("common.createdAt", { defaultValue: "Created At" })}
                            </Typography>
                            <Typography variant="body2">
                              {new Date(prescriptionDetailForView.created_at).toLocaleString()}
                            </Typography>
                          </Grid>
                        )}
                        {(prescriptionDetailForView as any).issued_at && (
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="caption" color="text.secondary">
                              {t("prescriptions.issuedAt", { defaultValue: "Issued At" })}
                            </Typography>
                            <Typography variant="body2">
                              {new Date((prescriptionDetailForView as any).issued_at).toLocaleString()}
                            </Typography>
                          </Grid>
                        )}
                        {(prescriptionDetailForView as any).dispensed_at && (
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="caption" color="text.secondary">
                              {t("prescriptions.dispensedAt", { defaultValue: "Dispensed At" })}
                            </Typography>
                            <Typography variant="body2">
                              {new Date((prescriptionDetailForView as any).dispensed_at).toLocaleString()}
                            </Typography>
                          </Grid>
                        )}
                        {(prescriptionDetailForView as any).updated_at && (
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="caption" color="text.secondary">
                              {t("common.updatedAt", { defaultValue: "Updated At" })}
                            </Typography>
                            <Typography variant="body2">
                              {new Date((prescriptionDetailForView as any).updated_at).toLocaleString()}
                            </Typography>
                          </Grid>
                        )}
                      </Grid>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ pr: 3, pb: 2 }}>
          <Button onClick={() => { setPrescriptionDetailOpen(false); setSelectedPrescriptionId(null); }}>
            {t("common.close", { defaultValue: "Close" })}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Close Visit Confirmation Dialog */}
      <Dialog open={closeVisitDialogOpen} onClose={() => setCloseVisitDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {t("appointments.closeVisitConfirmTitle", { defaultValue: "Close Visit - Confirm Action" })}
        </DialogTitle>
        <DialogContent>
          {appointmentToClose && (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                {t("appointments.closeVisitWarning", {
                  defaultValue: "Are you sure you want to close this visit without a prescription? This action cannot be undone.",
                })}
              </Alert>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>{t("appointments.patient", { defaultValue: "Patient" })}:</strong> {appointmentToClose.patient_name || "N/A"}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>{t("appointments.appointmentId", { defaultValue: "Appointment ID" })}:</strong> {formatAppointmentId(appointmentToClose)}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>{t("appointments.appointmentTime", { defaultValue: "Appointment Time" })}:</strong>{" "}
                  {appointmentToClose.scheduled_at
                    ? new Date(appointmentToClose.scheduled_at).toLocaleString()
                    : "N/A"}
                </Typography>
                {appointmentToClose.doctor_name && (
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>{t("appointments.doctor", { defaultValue: "Doctor" })}:</strong> {appointmentToClose.doctor_name}
                  </Typography>
                )}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseVisitDialogOpen(false)}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            onClick={() => {
              if (appointmentToClose) {
                completeMutation.mutate({
                  id: appointmentToClose.id,
                  withRx: false,
                });
                setCloseVisitDialogOpen(false);
                setAppointmentToClose(null);
              }
            }}
            color="primary"
            variant="contained"
          >
            {t("appointments.closeVisit", { defaultValue: "Close Visit" })}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Cancel Appointment Form Component
const CancelAppointmentForm: React.FC<{
  appointment: any;
  onCancel: (reason: string, note?: string) => void;
  onClose: () => void;
}> = ({ onCancel, onClose }) => {
  const { t } = useTranslation();
  const [reason, setReason] = React.useState<string>("");
  const [note, setNote] = React.useState<string>("");
  
  const handleSubmit = () => {
    if (!reason) {
      return;
    }
    onCancel(reason, note || undefined);
  };
  
  return (
    <Box sx={{ pt: 1 }}>
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel required>{t("appointments.cancellationReason", { defaultValue: "Cancellation Reason" })}</InputLabel>
        <Select
          value={reason}
          label={t("appointments.cancellationReason", { defaultValue: "Cancellation Reason" })}
          onChange={(e) => setReason(e.target.value)}
        >
          <MenuItem value="PATIENT_REQUEST">Patient Request</MenuItem>
          <MenuItem value="ADMITTED_TO_IPD">Admitted to IPD</MenuItem>
          <MenuItem value="DOCTOR_UNAVAILABLE">Doctor Unavailable</MenuItem>
          <MenuItem value="OTHER">Other</MenuItem>
        </Select>
      </FormControl>
      <TextField
        fullWidth
        multiline
        rows={3}
        label={t("appointments.cancellationNote", { defaultValue: "Note (Optional)" })}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        sx={{ mb: 2 }}
      />
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel", { defaultValue: "Cancel" })}</Button>
        <Button 
          variant="contained" 
          color="error" 
          onClick={handleSubmit}
          disabled={!reason}
        >
          {t("appointments.cancel", { defaultValue: "Cancel Appointment" })}
        </Button>
      </DialogActions>
    </Box>
  );
};

// Reschedule Appointment Form Component
const RescheduleAppointmentForm: React.FC<{
  appointment: any;
  onReschedule: (scheduledAt: string) => void;
  onClose: () => void;
}> = ({ appointment, onReschedule, onClose }) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const [scheduledAt, setScheduledAt] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  React.useEffect(() => {
    if (appointment?.scheduled_at) {
      const appointmentDate = new Date(appointment.scheduled_at);
      const now = new Date();
      
      // If appointment time has already passed, use current time; otherwise use appointment time
      const dateToUse = appointmentDate < now ? now : appointmentDate;
      
      // Round to next 15-minute slot
      const nextSlot = getNext15MinuteSlot(0);
      if (dateToUse > nextSlot) {
        // Use the appointment time rounded to next 15 minutes
        const rounded = roundToNext15Minutes(dateToUse);
        setScheduledAt(formatDateTimeLocal(rounded));
      } else {
        setScheduledAt(formatDateTimeLocal(nextSlot));
      }
    }
  }, [appointment]);
  
  const handleSubmit = async () => {
    if (!scheduledAt || isSubmitting) return;
    
    // Parse and validate 15-minute interval
    const localDate = parseDateTimeLocal(scheduledAt);
    if (isNaN(localDate.getTime())) {
      showError(t("appointments.invalidDateTime", { defaultValue: "Invalid date and time" }));
      return;
    }
    
    // Validate 15-minute interval
    if (!isValid15MinuteInterval(localDate)) {
      // Round to nearest 15 minutes
      const rounded = roundToNearest15Minutes(localDate);
      setScheduledAt(formatDateTimeLocal(rounded));
      showError(t("appointments.invalidTimeInterval", { 
        defaultValue: "Please select a time in 15-minute steps (e.g., 08:00, 08:15, 08:30, 08:45)." 
      }));
      return;
    }
    
    try {
      setIsSubmitting(true);
    // Convert to ISO string (UTC)
      const isoString = toUTCISOString(localDate);
      const rescheduledData = await rescheduleAppointment(appointment.id, isoString);
      
      // Extract appointment details for success message
      const patientName = rescheduledData?.patient_name || appointment?.patient_name || "Patient";
      const newScheduledAt = rescheduledData?.scheduled_at 
        ? new Date(rescheduledData.scheduled_at).toLocaleString()
        : "";
      const oldScheduledAt = appointment?.scheduled_at
        ? new Date(appointment.scheduled_at).toLocaleString()
        : "";
      
      // Show success toast (single source of truth - child component shows toast)
      showSuccess(
        t("appointments.rescheduleSuccessDetailed", { 
          defaultValue: "Appointment rescheduled for {{name}} from {{oldDate}} to {{newDate}}. Email notification sent.",
          name: patientName,
          oldDate: oldScheduledAt,
          newDate: newScheduledAt
        })
      );
      
      // Let parent close dialog and refresh data (don't call onClose here)
    onReschedule(isoString);
    } catch (error: any) {
      showError(error?.response?.data?.detail || t("appointments.rescheduleError", { defaultValue: "Failed to reschedule appointment" }));
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Box sx={{ pt: 1 }}>
      <TextField
        fullWidth
        type="datetime-local"
        label={t("appointments.newScheduledAt", { defaultValue: "New Scheduled Date & Time" })}
        value={scheduledAt}
        onChange={(e) => {
          const value = e.target.value;
          // Auto-correct to nearest 15-minute interval on change
          if (value) {
            try {
              const localDate = parseDateTimeLocal(value);
              if (!isValid15MinuteInterval(localDate)) {
                // Round to nearest 15 minutes
                const rounded = roundToNearest15Minutes(localDate);
                setScheduledAt(formatDateTimeLocal(rounded));
                return;
              }
            } catch {
              // Ignore parsing errors
            }
          }
          setScheduledAt(value);
        }}
        InputLabelProps={{ shrink: true }}
        helperText={t("appointments.timeIntervalHint", { 
          defaultValue: "Time must be in 15-minute intervals (00, 15, 30, 45)" 
        })}
        inputProps={{
          step: 900, // 15 minutes in seconds (for datetime-local input)
        }}
        sx={{ mb: 2 }}
      />
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2 }}>
        <Button onClick={onClose}>{t("common.cancel", { defaultValue: "Cancel" })}</Button>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleSubmit}
          disabled={!scheduledAt || isSubmitting}
        >
          {t("appointments.reschedule", { defaultValue: "Reschedule" })}
        </Button>
      </Box>
    </Box>
  );
};

export default AppointmentsPage;