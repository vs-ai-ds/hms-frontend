//src/app/features/dashboard/DashboardPage.tsx
import React from "react";
import { 
  Box, 
  Typography, 
  Paper, 
  CircularProgress, 
  Alert, 
  Chip, 
  Select, 
  MenuItem, 
  FormControl, 
  Tabs, 
  Tab,
  Tooltip,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import PageToolbar from "@app/components/common/PageToolbar";
import { apiClient } from "@app/lib/apiClient";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AppRoutes } from "@app/routes";
import { useAuthStore } from "@app/store/authStore";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { 
  People as PeopleIcon, 
  Event as EventIcon, 
  LocalPharmacy as PharmacyIcon,
  LocalHospital as HospitalIcon,
  Dashboard as DashboardIcon,
  Business as BusinessIcon,
  Warning as WarningIcon,
  Assignment as AssignmentIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayArrowIcon,
} from "@mui/icons-material";
import { getAppointmentStatusLabel, getPrescriptionStatusLabel, getPrescriptionStatusColor } from "@app/lib/utils/statusUtils";
import { formatDate } from "@app/lib/dateFormat";
import { useMutation, useQuery } from "@tanstack/react-query";
import { startDemoRefresh } from "@app/lib/api/admin";
import ConfirmationDialog from "@app/components/common/ConfirmationDialog";
import { Button, TextField } from "@mui/material";
import { useToast } from "@app/components/common/ToastProvider";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@app/lib/constants/demoCredentials";
import { useTaskStore } from "@app/store/taskStore";

interface DashboardMetrics {
  patients_today: number;
  upcoming_appointments: number;
  appointments_today: number;
  prescriptions_today: number;
  ipd_admissions_today: number;
  appointments_by_status: Record<string, number>;
  patient_registrations_last_7_days: Array<{ date: string; count: number }>;
  prescriptions_by_status: Record<string, number>;
  my_appointments_today: number;
  my_pending_prescriptions: number;
  prescriptions_to_dispense: number;
  low_stock_items_count: number;
  opd_scheduled_today: number;
  opd_checked_in_today: number;
  opd_in_consultation_today: number;
  opd_completed_today: number;
  active_ipd_admissions: number;
  pending_prescriptions_draft: number;
  pending_prescriptions_issued: number;
  doctor_pending_consultations?: number;
  receptionist_pending_checkins?: number;
  nurse_pending_vitals?: number;
  no_show_risk_count?: number;
  incomplete_clinical_notes?: number;
  patient_gender_distribution?: Record<string, number>;
  patient_age_distribution?: Record<string, number>;
  total_tenants?: number;
  total_users?: number;
  total_patients?: number;
  total_appointments?: number;
  total_prescriptions?: number;
}

const fetchMetrics = async (trendsDateRange?: string): Promise<DashboardMetrics> => {
  const params: any = {};
  if (trendsDateRange) params.trends_date_range = trendsDateRange;
  const res = await apiClient.get<DashboardMetrics>("/dashboard/metrics", { params });
  return res.data;
};

// Enhanced StatCard with clickable, tooltip, centered value, consistent icon placement
const StatCard: React.FC<{ 
  label: string; 
  value: string | number;
  onClick?: () => void;
  icon?: React.ReactNode;
  tooltipText?: string;
  centerValue?: boolean;
  iconPlacement?: "left" | "right";
}> = ({
  label,
  value,
  onClick,
  icon,
  tooltipText,
  centerValue = false,
  iconPlacement = "right",
}) => {
  const isClickable = onClick !== undefined && (typeof value === "number" ? value > 0 : true);
  
  const cardContent = (
    <Paper
      elevation={2}
      onClick={isClickable ? onClick : undefined}
      sx={{
        p: 3,
        borderRadius: 3,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        border: "1px solid rgba(0, 0, 0, 0.05)",
        transition: "all 0.3s ease",
        cursor: isClickable ? "pointer" : "default",
        height: "100%",
        "&:hover": isClickable ? {
          transform: "translateY(-2px)",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.1)",
        } : {},
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: centerValue ? 0 : 1 }}>
        {icon && iconPlacement === "left" && (
          <Box sx={{ color: "primary.main", display: "flex", alignItems: "center" }}>{icon}</Box>
        )}
        <Typography variant="subtitle2" color="text.secondary" fontWeight={500} sx={{ flex: 1 }}>
          {label}
        </Typography>
        {icon && iconPlacement === "right" && (
          <Box sx={{ color: "primary.main" }}>{icon}</Box>
        )}
      </Box>
      <Box sx={{ 
        display: "flex", 
        alignItems: centerValue ? "center" : "flex-start", 
        justifyContent: centerValue ? "center" : "flex-start",
        flex: 1,
        minHeight: centerValue ? "80px" : "auto"
      }}>
        <Typography
          variant="h4"
          fontWeight={700}
          sx={{
            color: typeof value === "number" && value === 0 ? "text.secondary" : "primary.main",
          }}
        >
          {value}
        </Typography>
      </Box>
    </Paper>
  );

  if (tooltipText) {
    return (
      <Tooltip title={tooltipText} arrow>
        {cardContent}
      </Tooltip>
    );
  }

  return cardContent;
};

// ClickableMetric component for OPD pipeline and Pending Actions
const ClickableMetric: React.FC<{
  value: number;
  label: string;
  color?: "info" | "warning" | "success" | "error" | "primary";
  onClick?: () => void;
  tooltipText?: string;
}> = ({ value, label, color = "primary", onClick, tooltipText }) => {
  const isClickable = value > 0 && onClick !== undefined;
  
  const content = (
    <Box
      onClick={isClickable ? onClick : undefined}
      sx={{
        cursor: isClickable ? "pointer" : "default",
        textAlign: "center",
        p: 2,
        borderRadius: 2,
        transition: "all 0.2s ease",
        "&:hover": isClickable ? {
          bgcolor: "action.hover",
          transform: "scale(1.02)",
        } : {},
      }}
    >
      <Typography 
        variant="h4" 
        fontWeight={700} 
        color={value === 0 ? "text.secondary" : `${color}.main`}
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );

  if (tooltipText) {
    return (
      <Tooltip title={tooltipText} arrow>
        {content}
      </Tooltip>
    );
  }

  return content;
};

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { showError } = useToast();
  const [trendsDateRange, setTrendsDateRange] = React.useState<string>("last_7_days");
  const [adminPendingTab, setAdminPendingTab] = React.useState<"ops" | "pharmacy">("ops");
  
  // Demo maintenance state
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const [seedDialogOpen, setSeedDialogOpen] = React.useState(false);
  const [resetDialogOpen, setResetDialogOpen] = React.useState(false);
  const [freshenDialogOpen, setFreshenDialogOpen] = React.useState(false);
  const [freshenDays, setFreshenDays] = React.useState(7);
  
  // Task store - Dashboard only reads from store, TopBar handles polling
  const { activeTask, setActiveTask } = useTaskStore();

  // Demo maintenance helpers - show immediately, even before API returns task_id
  const startLocalTask = (action: "seed" | "freshen" | "reset") => {
    setActiveTask({
      taskId: null, // temporary: no server id yet
      taskType:
        action === "seed" ? "DEMO_SEED" : action === "freshen" ? "DEMO_FRESHEN" : "DEMO_RESET",
      action,
      status: "PENDING",
      progress: 0,
      message:
        action === "seed"
          ? "Starting seed operation..."
          : action === "freshen"
          ? "Starting freshen operation..."
          : "Starting reset operation...",
      error: null,
      created_at: new Date().toISOString(),
      started_at: null,
      completed_at: null,
    });
  };

  // Demo maintenance mutations - Start async tasks
  const seedMutation = useMutation({
    mutationFn: async () => startDemoRefresh({ action: "seed" }),
    onMutate: () => {
      startLocalTask("seed");
    },
    onSuccess: (data) => {
      // IMPORTANT: set the real task id immediately so TopBar starts polling
      // Keep the existing message from onMutate until polling updates it
      setActiveTask({
        taskId: data.task_id,
        taskType: "DEMO_SEED",
        action: "seed",
        status: "PENDING",
        progress: activeTask?.progress ?? 0,
        message: activeTask?.message ?? "Starting seed operation...",
        error: null,
        created_at: activeTask?.created_at ?? new Date().toISOString(),
        started_at: activeTask?.started_at ?? null,
        completed_at: null,
      });
      setSeedDialogOpen(false);
    },
    onError: (error: any) => {
      // mark task as failed in bar
      setActiveTask({
        taskId: activeTask?.taskId ?? null,
        taskType: "DEMO_SEED",
        action: "seed",
        status: "FAILED",
        progress: 0,
        message: "Failed to start seed operation",
        error: error?.response?.data?.detail || "Failed to start seed operation",
        created_at: new Date().toISOString(),
        started_at: null,
        completed_at: new Date().toISOString(),
      });
      showError(
        error?.response?.data?.detail ||
          t("admin.demoSeedError", {
            defaultValue: "Failed to start seed operation",
          })
      );
    },
  });

  const freshenMutation = useMutation({
    mutationFn: async (days: number) => startDemoRefresh({ action: "freshen", freshen_days: days }),
    onMutate: () => {
      startLocalTask("freshen");
    },
    onSuccess: (data) => {
      setActiveTask({
        taskId: data.task_id,
        taskType: "DEMO_FRESHEN",
        action: "freshen",
        status: "PENDING",
        progress: activeTask?.progress ?? 0,
        message: activeTask?.message ?? "Starting freshen operation...",
        error: null,
        created_at: activeTask?.created_at ?? new Date().toISOString(),
        started_at: activeTask?.started_at ?? null,
        completed_at: null,
      });
    },
    onError: (error: any) => {
      setActiveTask({
        taskId: activeTask?.taskId ?? null,
        taskType: "DEMO_FRESHEN",
        action: "freshen",
        status: "FAILED",
        progress: 0,
        message: "Failed to start freshen operation",
        error: error?.response?.data?.detail || "Failed to start freshen operation",
        created_at: new Date().toISOString(),
        started_at: null,
        completed_at: new Date().toISOString(),
      });
      showError(
        error?.response?.data?.detail ||
          t("admin.demoFreshenError", {
            defaultValue: "Failed to start freshen operation",
          })
      );
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => startDemoRefresh({ action: "reset" }),
    onMutate: () => {
      startLocalTask("reset");
    },
    onSuccess: (data) => {
      setActiveTask({
        taskId: data.task_id,
        taskType: "DEMO_RESET",
        action: "reset",
        status: "PENDING",
        progress: activeTask?.progress ?? 0,
        message: activeTask?.message ?? "Starting reset operation...",
        error: null,
        created_at: activeTask?.created_at ?? new Date().toISOString(),
        started_at: activeTask?.started_at ?? null,
        completed_at: null,
      });
      setResetDialogOpen(false);
    },
    onError: (error: any) => {
      setActiveTask({
        taskId: activeTask?.taskId ?? null,
        taskType: "DEMO_RESET",
        action: "reset",
        status: "FAILED",
        progress: 0,
        message: "Failed to start reset operation",
        error: error?.response?.data?.detail || "Failed to start reset operation",
        created_at: new Date().toISOString(),
        started_at: null,
        completed_at: new Date().toISOString(),
      });
      showError(
        error?.response?.data?.detail ||
          t("admin.demoResetError", {
            defaultValue: "Failed to start reset operation",
          })
      );
    },
  });
  
  // Split queries: Live metrics (no date range) and Trends metrics (with date range)
  const { data: liveData, isLoading: liveLoading, isError: liveError, error: liveErrorObj } = useQuery({
    queryKey: ["dashboard-metrics-live"],
    queryFn: () => fetchMetrics("last_7_days"), // Use default, backend ignores for live metrics
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 30000, // 30 seconds
  });

  const { data: trendsData, isLoading: trendsLoading, isError: trendsError, error: trendsErrorObj } = useQuery({
    queryKey: ["dashboard-metrics-trends", trendsDateRange],
    queryFn: () => fetchMetrics(trendsDateRange),
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev, // Prevents "refreshing whole page" feeling
  });

  // Merge data: use live data for live metrics, trends data for trends metrics
  const data = React.useMemo((): DashboardMetrics | null => {
    if (!liveData && !trendsData) return null;
    const live = liveData as DashboardMetrics | undefined;
    const trends = trendsData as DashboardMetrics | undefined;
    return {
      patients_today: live?.patients_today ?? trends?.patients_today ?? 0,
      upcoming_appointments: live?.upcoming_appointments ?? trends?.upcoming_appointments ?? 0,
      appointments_today: live?.appointments_today ?? trends?.appointments_today ?? 0,
      prescriptions_today: live?.prescriptions_today ?? trends?.prescriptions_today ?? 0,
      ipd_admissions_today: live?.ipd_admissions_today ?? trends?.ipd_admissions_today ?? 0,
      appointments_by_status: trends?.appointments_by_status ?? live?.appointments_by_status ?? {},
      patient_registrations_last_7_days: trends?.patient_registrations_last_7_days ?? live?.patient_registrations_last_7_days ?? [],
      prescriptions_by_status: trends?.prescriptions_by_status ?? live?.prescriptions_by_status ?? {},
      my_appointments_today: live?.my_appointments_today ?? trends?.my_appointments_today ?? 0,
      my_pending_prescriptions: live?.my_pending_prescriptions ?? trends?.my_pending_prescriptions ?? 0,
      prescriptions_to_dispense: live?.prescriptions_to_dispense ?? trends?.prescriptions_to_dispense ?? 0,
      low_stock_items_count: live?.low_stock_items_count ?? trends?.low_stock_items_count ?? 0,
      opd_scheduled_today: live?.opd_scheduled_today ?? trends?.opd_scheduled_today ?? 0,
      opd_checked_in_today: live?.opd_checked_in_today ?? trends?.opd_checked_in_today ?? 0,
      opd_in_consultation_today: live?.opd_in_consultation_today ?? trends?.opd_in_consultation_today ?? 0,
      opd_completed_today: live?.opd_completed_today ?? trends?.opd_completed_today ?? 0,
      active_ipd_admissions: live?.active_ipd_admissions ?? trends?.active_ipd_admissions ?? 0,
      pending_prescriptions_draft: live?.pending_prescriptions_draft ?? trends?.pending_prescriptions_draft ?? 0,
      pending_prescriptions_issued: live?.pending_prescriptions_issued ?? trends?.pending_prescriptions_issued ?? 0,
      doctor_pending_consultations: live?.doctor_pending_consultations ?? trends?.doctor_pending_consultations ?? 0,
      receptionist_pending_checkins: live?.receptionist_pending_checkins ?? trends?.receptionist_pending_checkins ?? 0,
      nurse_pending_vitals: live?.nurse_pending_vitals ?? trends?.nurse_pending_vitals ?? 0,
      no_show_risk_count: live?.no_show_risk_count ?? trends?.no_show_risk_count ?? 0,
      incomplete_clinical_notes: live?.incomplete_clinical_notes ?? trends?.incomplete_clinical_notes ?? 0,
      patient_gender_distribution: trends?.patient_gender_distribution ?? live?.patient_gender_distribution ?? {},
      patient_age_distribution: trends?.patient_age_distribution ?? live?.patient_age_distribution ?? {},
      total_tenants: live?.total_tenants ?? trends?.total_tenants ?? 0,
      total_users: live?.total_users ?? trends?.total_users ?? 0,
      total_patients: live?.total_patients ?? trends?.total_patients ?? 0,
      total_appointments: live?.total_appointments ?? trends?.total_appointments ?? 0,
      total_prescriptions: live?.total_prescriptions ?? trends?.total_prescriptions ?? 0,
    };
  }, [liveData, trendsData]);

  const isLoading = liveLoading || trendsLoading;
  const isError = liveError || trendsError;
  const error = liveErrorObj || trendsErrorObj;

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    const isSuperAdmin = user?.tenant_id === null || user?.roles?.some((r: any) => r.name === "SUPER_ADMIN");
    const errorMessage = error instanceof Error ? error.message : String(error);
    const is403 = errorMessage.includes("403") || errorMessage.includes("Forbidden");
    
    return (
      <Box>
        <PageToolbar
          title={t("dashboard.title", { defaultValue: "Dashboard" })}
          subtitle={isSuperAdmin 
            ? t("dashboard.subtitleSuperAdmin", { defaultValue: "Platform overview and tenant management." })
            : t("dashboard.subtitle", {
                defaultValue: "Overview of hospital operations, patient activity, and key metrics.",
              })
          }
          titleIcon={<DashboardIcon sx={{ fontSize: 32 }} />}
        />
        <Alert severity="error" sx={{ mt: 3, borderRadius: 2 }}>
          {is403 && isSuperAdmin
            ? t("dashboard.errorSuperAdmin", { 
                defaultValue: "Unable to load platform metrics. This may be a temporary issue." 
              })
            : t("dashboard.error", { 
                defaultValue: "Failed to load dashboard metrics. Please try again later." 
              })}
          {!is403 && error instanceof Error && `: ${error.message}`}
        </Alert>
      </Box>
    );
  }

  const metrics: DashboardMetrics = data || {
    patients_today: 0,
    upcoming_appointments: 0,
    appointments_today: 0,
    prescriptions_today: 0,
    ipd_admissions_today: 0,
    appointments_by_status: {},
    patient_registrations_last_7_days: [],
    prescriptions_by_status: {},
    my_appointments_today: 0,
    my_pending_prescriptions: 0,
    prescriptions_to_dispense: 0,
    low_stock_items_count: 0,
    opd_scheduled_today: 0,
    opd_checked_in_today: 0,
    opd_in_consultation_today: 0,
    opd_completed_today: 0,
    active_ipd_admissions: 0,
    pending_prescriptions_draft: 0,
    pending_prescriptions_issued: 0,
    doctor_pending_consultations: 0,
    receptionist_pending_checkins: 0,
    nurse_pending_vitals: 0,
    no_show_risk_count: 0,
    incomplete_clinical_notes: 0,
    patient_gender_distribution: {},
    patient_age_distribution: {},
    total_tenants: 0,
    total_users: 0,
    total_patients: 0,
    total_appointments: 0,
    total_prescriptions: 0,
  };

  // Determine user roles
  const userRoles = user?.roles?.map(r => r.name) || [];
  const isDoctor = userRoles.includes("DOCTOR");
  const isPharmacist = userRoles.includes("PHARMACIST");
  const isNurse = userRoles.includes("NURSE");
  const isReceptionist = userRoles.includes("RECEPTIONIST");
  const isAdmin = userRoles.includes("HOSPITAL_ADMIN") || userRoles.includes("SUPER_ADMIN");
  const isSuperAdmin = user?.tenant_id === null || userRoles.includes("SUPER_ADMIN");

  const handleSeed = () => {
    setSeedDialogOpen(true);
  };

  const handleConfirmSeed = () => {
    seedMutation.mutate();
  };

  const handleFreshen = () => {
    setFreshenDialogOpen(true);
  };

  const handleConfirmFreshen = () => {
    freshenMutation.mutate(freshenDays);
    setFreshenDialogOpen(false);
  };

  const handleReset = () => {
    setResetDialogOpen(true);
  };

  const handleConfirmReset = () => {
    resetMutation.mutate();
    setResetDialogOpen(false);
  };

  // Helper to build appointment filter URL - navigate to ALL tab with filters preserved
  // All dashboard widgets should navigate to appointments page with ALL tab selected and their filters applied
  const buildAppointmentUrl = (status?: string | string[] | null, additionalParams?: Record<string, string>) => {
    const params = new URLSearchParams();
    params.set("segment", "ALL");
    
    // Add status filter if provided
    if (status && status !== "TOTAL" && status !== null) {
      if (Array.isArray(status)) {
        params.set("status", status.join(","));
      } else {
        params.set("status", status);
      }
    }
    
    // Add date filters
    const today = new Date().toISOString().split("T")[0];
    if (additionalParams?.date === "today") {
      params.set("date_from", today);
      params.set("date_to", today);
    } else {
      if (additionalParams?.date_from) params.set("date_from", additionalParams.date_from);
      if (additionalParams?.date_to) params.set("date_to", additionalParams.date_to);
    }
    
    // Add other filters
    if (additionalParams?.doctor_id) {
      params.set("doctor_user_id", additionalParams.doctor_id);
    }
    if (additionalParams?.department_id) {
      params.set("department_id", additionalParams.department_id);
    }
    
    return `${AppRoutes.APPOINTMENTS}?${params.toString()}`;
  };

  // Helper to build prescription filter URL
  const buildPrescriptionUrl = (status: string, dateFrom?: string, dateTo?: string) => {
    const params = new URLSearchParams({ status });
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    return `${AppRoutes.PRESCRIPTIONS}?${params.toString()}`;
  };

  // Helper to get date range for trends (supports "today")
  const getTrendsDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (trendsDateRange === "today") {
      return {
        from: today.toISOString().split("T")[0],
        to: today.toISOString().split("T")[0],
      };
    }
    
    let startDate: Date;
    if (trendsDateRange === "last_7_days") {
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 7);
    } else if (trendsDateRange === "last_30_days") {
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 30);
    } else {
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 90);
    }
    return {
      from: startDate.toISOString().split("T")[0],
      to: today.toISOString().split("T")[0],
    };
  };

  // Helper to get range label
  const getRangeLabel = () => {
    if (trendsDateRange === "today") return t("dashboard.today", { defaultValue: "Today" });
    if (trendsDateRange === "last_7_days") return t("dashboard.last7Days", { defaultValue: "Last 7 days" });
    if (trendsDateRange === "last_30_days") return t("dashboard.last30Days", { defaultValue: "Last 30 days" });
    return t("dashboard.last90Days", { defaultValue: "Last 90 days" });
  };

  // SUPER_ADMIN view (unchanged)
  if (isSuperAdmin) {
    return (
      <Box sx={{ width: "100%" }}>
        <PageToolbar
          title={t("dashboard.title", { defaultValue: "Dashboard" })}
          subtitle={t("dashboard.subtitleSuperAdmin", { defaultValue: "Platform overview and tenant management." })}
          titleIcon={<DashboardIcon sx={{ fontSize: 32 }} />}
        />
        <Grid container spacing={3} sx={{ mb: 4, mt: 1 }}>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <StatCard 
              label={t("dashboard.totalTenants", { defaultValue: "Total Tenants" })} 
              value={metrics.total_tenants || 0}
              icon={<BusinessIcon />}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <StatCard 
              label={t("dashboard.totalStaffUsers", { defaultValue: "Total Staff Users" })} 
              value={metrics.total_users || 0}
              icon={<PeopleIcon />}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <StatCard 
              label={t("dashboard.totalPatients", { defaultValue: "Total Patients" })} 
              value={metrics.total_patients || 0}
              icon={<PeopleIcon />}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <StatCard 
              label={t("dashboard.totalAppointments", { defaultValue: "Total Appointments" })} 
              value={metrics.total_appointments || 0}
              icon={<EventIcon />}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <StatCard 
              label={t("dashboard.totalPrescriptions", { defaultValue: "Total Prescriptions" })} 
              value={metrics.total_prescriptions || 0}
              icon={<PharmacyIcon />}
            />
          </Grid>
        </Grid>

        {/* Demo Maintenance Card - Only visible in DEMO_MODE for SUPER_ADMIN */}
        {isDemoMode && (
          <>
            <Grid size={{ xs: 12 }}>
              <Paper elevation={2} sx={{ p: 3, borderRadius: 3, mt: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                  <RefreshIcon sx={{ color: "primary.main" }} />
                  <Typography variant="h6" fontWeight={600}>
                    {t("admin.demoMaintenance", { defaultValue: "Demo Maintenance" })}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {t("admin.demoMaintenanceDescription", {
                    defaultValue: "Manage demo data: seed fresh data or freshen existing data by shifting dates forward.",
                  })}
                </Typography>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<PlayArrowIcon />}
                    onClick={handleSeed}
                    disabled={
                      seedMutation.isPending ||
                      freshenMutation.isPending ||
                      resetMutation.isPending ||
                      (activeTask?.status === "PENDING" || activeTask?.status === "RUNNING")
                    }
                  >
                    {t("admin.seedDemoData", { defaultValue: "Seed Demo Data" })}
                  </Button>
                  <Button
                    variant="contained"
                    color="warning"
                    startIcon={<WarningIcon />}
                    onClick={handleReset}
                    disabled={
                      seedMutation.isPending ||
                      freshenMutation.isPending ||
                      resetMutation.isPending ||
                      (activeTask?.status === "PENDING" || activeTask?.status === "RUNNING")
                    }
                  >
                    {t("admin.resetDemoData", { defaultValue: "Reset Demo Data" })}
                  </Button>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    <TextField
                      type="number"
                      label={t("admin.freshenDays", { defaultValue: "Freshen Days" })}
                      value={freshenDays}
                      onChange={(e) => setFreshenDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 7)))}
                      inputProps={{ min: 1, max: 365 }}
                      size="small"
                      sx={{ width: 120 }}
                    />
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<RefreshIcon />}
                      onClick={handleFreshen}
                      disabled={
                        seedMutation.isPending ||
                        freshenMutation.isPending ||
                        resetMutation.isPending ||
                        (activeTask?.status === "PENDING" || activeTask?.status === "RUNNING")
                      }
                    >
                      {t("admin.freshenDemoData", { defaultValue: "Freshen Demo Data" })}
                    </Button>
                  </Box>
                </Box>
              </Paper>
            </Grid>

            {/* Demo Credentials Card */}
            <Grid size={{ xs: 12 }}>
              <Paper elevation={2} sx={{ p: 3, borderRadius: 3, mt: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                  <InfoIcon sx={{ color: "primary.main" }} />
                  <Typography variant="h6" fontWeight={600}>
                    {t("admin.demoCredentials", { defaultValue: "Demo Account Credentials" })}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {t("admin.demoCredentialsDescription", {
                    defaultValue: "Use these credentials to log in as different roles. Password is the same for all accounts.",
                  })}
                </Typography>
                <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                  {/* Tenant A */}
                  <Box sx={{ flex: 1, minWidth: 300 }}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: "primary.main" }}>
                      {t("admin.tenantA", { defaultValue: "Tenant A" })}
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      {(["admin", "doctor", "nurse", "pharmacist", "receptionist"] as const).map((role) => {
                        const account = DEMO_ACCOUNTS.A[role];
                        return (
                          <Box
                            key={role}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              p: 1,
                              borderRadius: 1,
                              bgcolor: "action.hover",
                            }}
                          >
                            <Chip
                              label={t(`auth.demo.role.${role}`, {
                                defaultValue: role.charAt(0).toUpperCase() + role.slice(1),
                              })}
                              size="small"
                              sx={{ minWidth: 100 }}
                            />
                            <Typography variant="body2" sx={{ flex: 1, fontFamily: "monospace" }}>
                              {account.email}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>

                  {/* Tenant B */}
                  <Box sx={{ flex: 1, minWidth: 300 }}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: "primary.main" }}>
                      {t("admin.tenantB", { defaultValue: "Tenant B" })}
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      {(["admin", "doctor", "nurse", "pharmacist", "receptionist"] as const).map((role) => {
                        const account = DEMO_ACCOUNTS.B[role];
                        return (
                          <Box
                            key={role}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              p: 1,
                              borderRadius: 1,
                              bgcolor: "action.hover",
                            }}
                          >
                            <Chip
                              label={t(`auth.demo.role.${role}`, {
                                defaultValue: role.charAt(0).toUpperCase() + role.slice(1),
                              })}
                              size="small"
                              sx={{ minWidth: 100 }}
                            />
                            <Typography variant="body2" sx={{ flex: 1, fontFamily: "monospace" }}>
                              {account.email}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                </Box>
                <Box sx={{ mt: 2, p: 1.5, borderRadius: 1, bgcolor: "info.light", color: "info.contrastText" }}>
                  <Typography variant="body2" fontWeight={600}>
                    {t("admin.demoPassword", { defaultValue: "Password (all accounts)" })}:{" "}
                    <Box component="span" sx={{ fontFamily: "monospace", fontWeight: 700 }}>
                      {DEMO_PASSWORD}
                    </Box>
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </>
        )}

        {/* Seed Confirmation Dialog */}
        <ConfirmationDialog
          open={seedDialogOpen}
          onClose={() => setSeedDialogOpen(false)}
          onConfirm={handleConfirmSeed}
          title={t("admin.seedDemoDataTitle", { defaultValue: "Seed Demo Data" })}
          message={t("admin.seedDemoDataConfirm", {
            defaultValue:
              "This will create fresh demo data for both demo tenants. This operation may take several minutes. Continue?",
          })}
          confirmText={t("admin.seed", { defaultValue: "Seed" })}
          confirmColor="error"
          isLoading={seedMutation.isPending}
        />

        {/* Freshen Confirmation Dialog */}
        <ConfirmationDialog
          open={freshenDialogOpen}
          onClose={() => setFreshenDialogOpen(false)}
          onConfirm={handleConfirmFreshen}
          title={t("admin.freshenDemoDataTitle", { defaultValue: "Freshen Demo Data" })}
          message={t("admin.freshenDemoDataConfirm", {
            defaultValue:
              `This will shift all demo data dates forward by ${freshenDays} days. This operation may take a few minutes. Continue?`,
            days: freshenDays,
          })}
          confirmText={t("admin.freshen", { defaultValue: "Freshen" })}
          confirmColor="primary"
          isLoading={freshenMutation.isPending}
        />

        {/* Reset Confirmation Dialog */}
        <ConfirmationDialog
          open={resetDialogOpen}
          onClose={() => setResetDialogOpen(false)}
          onConfirm={handleConfirmReset}
          title={t("admin.resetDemoDataTitle", { defaultValue: "Reset Demo Data" })}
          message={t("admin.resetDemoDataConfirm", {
            defaultValue:
              "This will delete all demo data for both demo tenants. This operation cannot be undone. Continue?",
          })}
          confirmText={t("admin.reset", { defaultValue: "Reset" })}
          confirmColor="warning"
          isLoading={resetMutation.isPending}
        />
      </Box>
    );
  }

  // Regular tenant dashboard
  return (
    <Box sx={{ width: "100%" }}>
      <PageToolbar
        title={t("dashboard.title", { defaultValue: "Dashboard" })}
        subtitle={t("dashboard.subtitle", {
          defaultValue: "Overview of hospital operations, patient activity, and key metrics.",
        })}
        titleIcon={<DashboardIcon sx={{ fontSize: 32 }} />}
      />

      {/* Section A: Live Today */}
      <Typography variant="h5" fontWeight={600} sx={{ mt: 3, mb: 2 }}>
        {t("dashboard.liveToday", { defaultValue: "Live Today" })}
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* A1: OPD Today */}
        {(isDoctor || isReceptionist || isNurse || isPharmacist || isAdmin) && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3, height: "100%" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <EventIcon sx={{ color: "primary.main" }} />
                <Typography variant="h6" fontWeight={600}>
                  {t("dashboard.opdToday", { defaultValue: "OPD Today" })}
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <ClickableMetric
                    value={metrics.opd_scheduled_today || 0}
                    label={t("dashboard.scheduled", { defaultValue: "Scheduled" })}
                    color="info"
                    onClick={(metrics.opd_scheduled_today || 0) > 0 ? () => navigate(buildAppointmentUrl("SCHEDULED", { date: "today" })) : undefined}
                    tooltipText={t("dashboard.viewOpdAppointmentsToday", { 
                      defaultValue: "View OPD appointments for today with status Scheduled" 
                    })}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <ClickableMetric
                    value={metrics.opd_checked_in_today || 0}
                    label={t("dashboard.checkedIn", { defaultValue: "Checked-in" })}
                    color="warning"
                    onClick={(metrics.opd_checked_in_today || 0) > 0 ? () => navigate(buildAppointmentUrl("CHECKED_IN", { date: "today" })) : undefined}
                    tooltipText={t("dashboard.viewOpdAppointmentsToday", { 
                      defaultValue: "View OPD appointments for today with status Checked-in" 
                    })}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <ClickableMetric
                    value={metrics.opd_in_consultation_today || 0}
                    label={t("dashboard.inConsultation", { defaultValue: "In consultation" })}
                    color="warning"
                    onClick={(metrics.opd_in_consultation_today || 0) > 0 ? () => navigate(buildAppointmentUrl("IN_CONSULTATION", { date: "today" })) : undefined}
                    tooltipText={t("dashboard.viewOpdAppointmentsToday", { 
                      defaultValue: "View OPD appointments for today with status In consultation" 
                    })}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <ClickableMetric
                    value={metrics.opd_completed_today || 0}
                    label={t("dashboard.completed", { defaultValue: "Completed" })}
                    color="success"
                    onClick={(metrics.opd_completed_today || 0) > 0 ? () => navigate(buildAppointmentUrl("COMPLETED", { date: "today" })) : undefined}
                    tooltipText={t("dashboard.viewOpdAppointmentsToday", { 
                      defaultValue: "View OPD appointments for today with status Completed" 
                    })}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        )}

        {/* A2: Active IPD */}
        {(isDoctor || isNurse || isAdmin) && (
          <Grid size={{ xs: 12, md: 3 }}>
            <Paper 
              elevation={2} 
              onClick={(metrics.active_ipd_admissions || 0) > 0 ? () => navigate(`${AppRoutes.PATIENTS}?care_type=IPD`) : undefined}
              sx={{
                p: 3,
                borderRadius: 3,
                display: "flex",
                flexDirection: "column",
                gap: 1,
                border: "1px solid rgba(0, 0, 0, 0.05)",
                transition: "all 0.3s ease",
                cursor: (metrics.active_ipd_admissions || 0) > 0 ? "pointer" : "default",
                height: "100%",
                "&:hover": (metrics.active_ipd_admissions || 0) > 0 ? {
                  transform: "translateY(-2px)",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.1)",
                } : {},
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                <HospitalIcon sx={{ color: "primary.main", fontSize: 20 }} />
                <Typography variant="h6" fontWeight={600}>
                  {t("dashboard.activeIpd", { defaultValue: "Active IPD" })}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Typography
                  variant="h4"
                  fontWeight={700}
                  sx={{
                    color: (metrics.active_ipd_admissions || 0) === 0 ? "text.secondary" : "primary.main",
                  }}
                >
                  {metrics.active_ipd_admissions || 0}
                </Typography>
                </Box>
              </Paper>
            </Grid>
        )}

        {/* A3: Pending Actions (Role-aware) */}
        <Grid size={{ xs: 12, md: 3 }}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 3, height: "100%", display: "flex", flexDirection: "column" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
              <InfoIcon sx={{ color: "primary.main", fontSize: 20 }} />
              <Typography variant="h6" fontWeight={600}>
                {t("dashboard.pendingActions", { defaultValue: "Pending Actions" })}
              </Typography>
            </Box>
            
            {isDoctor && (
              <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <Tooltip title={t("dashboard.opdNeedingConsultation", { defaultValue: "OPD needing consultation" })} arrow>
                  <Typography 
                    variant="h4" 
                    fontWeight={700} 
                    color="warning.main"
                    sx={{ 
                      cursor: (metrics.doctor_pending_consultations || 0) > 0 ? "pointer" : "default",
                      transition: "all 0.2s ease",
                      "&:hover": (metrics.doctor_pending_consultations || 0) > 0 ? { transform: "scale(1.05)" } : {},
                    }}
                    onClick={(metrics.doctor_pending_consultations || 0) > 0 ? () => navigate(buildAppointmentUrl(["CHECKED_IN", "IN_CONSULTATION"], { date: "today", doctor_id: user?.id || "" })) : undefined}
                  >
                    {metrics.doctor_pending_consultations || 0}
                  </Typography>
                </Tooltip>
              </Box>
            )}

            {isReceptionist && (
              <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <Tooltip title={t("dashboard.arrivalsPendingCheckin", { defaultValue: "Arrivals pending check-in" })} arrow>
                  <Typography 
                    variant="h4" 
                    fontWeight={700} 
                    color="info.main"
                    sx={{ 
                      cursor: (metrics.receptionist_pending_checkins || 0) > 0 ? "pointer" : "default",
                      transition: "all 0.2s ease",
                      "&:hover": (metrics.receptionist_pending_checkins || 0) > 0 ? { transform: "scale(1.05)" } : {},
                    }}
                    onClick={(metrics.receptionist_pending_checkins || 0) > 0 ? () => navigate(buildAppointmentUrl("SCHEDULED")) : undefined}
                  >
                    {metrics.receptionist_pending_checkins || 0}
                  </Typography>
                </Tooltip>
              </Box>
            )}

            {isPharmacist && (
              <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <Tooltip title={t("dashboard.rxToDispense", { defaultValue: "Rx to dispense" })} arrow>
                  <Typography 
                    variant="h4" 
                    fontWeight={700} 
                    color="warning.main"
                    sx={{ 
                      cursor: (metrics.prescriptions_to_dispense || 0) > 0 ? "pointer" : "default",
                      transition: "all 0.2s ease",
                      "&:hover": (metrics.prescriptions_to_dispense || 0) > 0 ? { transform: "scale(1.05)" } : {},
                    }}
                    onClick={(metrics.prescriptions_to_dispense || 0) > 0 ? () => navigate(buildPrescriptionUrl("ISSUED")) : undefined}
                  >
                    {metrics.prescriptions_to_dispense || 0}
                  </Typography>
                </Tooltip>
              </Box>
            )}

            {isNurse && (
              <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <Tooltip title={t("dashboard.vitalsMissing", { defaultValue: "Vitals missing" })} arrow>
                  <Typography 
                    variant="h4" 
                    fontWeight={700} 
                    color="warning.main"
                    sx={{ 
                      cursor: (metrics.nurse_pending_vitals || 0) > 0 ? "pointer" : "default",
                      transition: "all 0.2s ease",
                      "&:hover": (metrics.nurse_pending_vitals || 0) > 0 ? { transform: "scale(1.05)" } : {},
                    }}
                    onClick={(metrics.nurse_pending_vitals || 0) > 0 ? () => navigate(buildAppointmentUrl("CHECKED_IN")) : undefined}
                  >
                    {metrics.nurse_pending_vitals || 0}
                  </Typography>
                </Tooltip>
              </Box>
            )}

            {isAdmin && (
              <>
                <Tabs value={adminPendingTab} onChange={(_, v) => setAdminPendingTab(v)} sx={{ mb: 1, mt: 0.5 }}>
                  <Tab label={t("dashboard.todayOps", { defaultValue: "Today Ops" })} value="ops" />
                  <Tab label={t("dashboard.pharmacyQueue", { defaultValue: "Pharmacy Queue" })} value="pharmacy" />
                </Tabs>
                <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  {adminPendingTab === "ops" ? (
                    <Tooltip title={t("dashboard.checkedInInConsult", { defaultValue: "Checked-in + In consultation (today)" })} arrow>
                      <Typography 
                        variant="h4" 
                        fontWeight={700} 
                        color="warning.main"
                        sx={{ 
                          cursor: ((metrics.opd_checked_in_today || 0) + (metrics.opd_in_consultation_today || 0)) > 0 ? "pointer" : "default",
                          transition: "all 0.2s ease",
                          "&:hover": ((metrics.opd_checked_in_today || 0) + (metrics.opd_in_consultation_today || 0)) > 0 ? { transform: "scale(1.05)" } : {},
                        }}
                        onClick={((metrics.opd_checked_in_today || 0) + (metrics.opd_in_consultation_today || 0)) > 0 ? () => navigate(buildAppointmentUrl(["CHECKED_IN", "IN_CONSULTATION"], { date: "today" })) : undefined}
                      >
                        {(metrics.opd_checked_in_today || 0) + (metrics.opd_in_consultation_today || 0)}
                      </Typography>
                    </Tooltip>
                  ) : (
                    <Tooltip title={t("dashboard.issuedPrescriptions", { defaultValue: "Issued prescriptions ready for dispensing" })} arrow>
                      <Typography 
                        variant="h4" 
                        fontWeight={700} 
                        color="warning.main"
                        sx={{ 
                          cursor: ((metrics.prescriptions_to_dispense || 0) + (metrics.pending_prescriptions_issued || 0)) > 0 ? "pointer" : "default",
                          transition: "all 0.2s ease",
                          "&:hover": ((metrics.prescriptions_to_dispense || 0) + (metrics.pending_prescriptions_issued || 0)) > 0 ? { transform: "scale(1.05)" } : {},
                        }}
                        onClick={((metrics.prescriptions_to_dispense || 0) + (metrics.pending_prescriptions_issued || 0)) > 0 ? () => navigate(buildPrescriptionUrl("ISSUED")) : undefined}
                      >
                        {(metrics.prescriptions_to_dispense || 0) + (metrics.pending_prescriptions_issued || 0)}
                      </Typography>
                    </Tooltip>
                  )}
                </Box>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Section B: Trends */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          {t("dashboard.trends", { defaultValue: "Trends" })}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {t("dashboard.appliesToTrends", { defaultValue: "Applies to trends" })}
          </Typography>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={trendsDateRange}
              onChange={(e) => setTrendsDateRange(e.target.value)}
            >
              <MenuItem value="today">{t("dashboard.today", { defaultValue: "Today" })}</MenuItem>
              <MenuItem value="last_7_days">{t("dashboard.last7Days", { defaultValue: "Last 7 days" })}</MenuItem>
              <MenuItem value="last_30_days">{t("dashboard.last30Days", { defaultValue: "Last 30 days" })}</MenuItem>
              <MenuItem value="last_90_days">{t("dashboard.last90Days", { defaultValue: "Last 90 days" })}</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* B1: Patient Registrations Trend */}
        {(isDoctor || isReceptionist || isAdmin) && (() => {
          const raw = metrics.patient_registrations_last_7_days || [];
          const total = raw.reduce((sum, d) => sum + (d.count || 0), 0);

          // IMPORTANT: keep raw date (YYYY-MM-DD) for URL filters
          const chartData = raw.map((d) => ({
            ...d,
            formattedDate: formatDate(d.date),
            // keep `date` as-is (expected YYYY-MM-DD)
            date: d.date,
          }));

          // Custom clickable dot: dot click = single-day drilldown
          const ClickableDot = (props: any) => {
            const { cx, cy, payload } = props;
            if (cx == null || cy == null) return null;

            const count = payload?.count ?? 0;
            const date = payload?.date; // YYYY-MM-DD
            const clickable = count > 0 && !!date;

            return (
              <circle
                cx={cx}
                cy={cy}
                r={4}
                fill="#1d7af3"
                style={{ cursor: clickable ? "pointer" : "default" }}
                onClick={(e) => {
                  e.stopPropagation(); // prevents chart-level onClick
                  if (!clickable) return;
                  navigate(`${AppRoutes.PATIENTS}?registered_from=${date}&registered_to=${date}`);
                }}
              />
            );
          };

          return (
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  // Optional: remove focus outline if you see the black border rectangle after click
                  "& .recharts-wrapper:focus, & .recharts-surface:focus": { outline: "none" },
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                  <Typography variant="h6" fontWeight={600}>
                    {t("dashboard.patientRegistrations", { defaultValue: "Patient Registrations" })} ({getRangeLabel()})
                  </Typography>
                  <Chip label={`Total: ${total}`} size="small" color="primary" />
                </Box>

                {chartData.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={chartData}
                      // Chart click = full-range drilldown (keep your current behavior)
                      onClick={
                        total > 0
                          ? () => {
                              const range = getTrendsDateRange();
                              navigate(`${AppRoutes.PATIENTS}?registered_from=${range.from}&registered_to=${range.to}`);
                            }
                          : undefined
                      }
                      style={{ cursor: total > 0 ? "pointer" : "default" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.1)" />
                      <XAxis dataKey="formattedDate" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <RechartsTooltip
                        separator="" // avoids the "name: value" colon weirdness
                        formatter={(value: any, _name: any, props: any) => {
                          const p = props?.payload;
                          if (!p) return [String(value), ""];
                          const v = Number(value);
                          return [`${p.formattedDate}: ${v} Registration${v !== 1 ? "s" : ""}`, ""];
                        }}
                        labelFormatter={() => ""}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#1d7af3"
                        strokeWidth={2}
                        dot={<ClickableDot />}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ height: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <Typography variant="body2" color="text.secondary" mb={1}>
                      {t("dashboard.notEnoughData", { defaultValue: "Not enough data to plot trend yet." })}
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          );
        })()}

        {/* B2: Appointments Outcome */}
        {(isDoctor || isReceptionist || isNurse || isAdmin) && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper 
              elevation={2} 
              sx={{ p: 3, borderRadius: 3,
                "& .recharts-wrapper:focus, & .recharts-surface:focus": {
                  outline: "none",
                },

                // Some browsers draw focus ring with this:
                "& .recharts-wrapper, & .recharts-surface": {
                  WebkitTapHighlightColor: "transparent",
                },
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  {t("dashboard.appointmentsSummary", { defaultValue: "Appointments Summary" })} ({getRangeLabel()})
                </Typography>
                {(() => {
                  const statusEntries = Object.entries(metrics.appointments_by_status || {});
                  const totalCount = statusEntries.reduce((sum, [_, count]) => sum + (count || 0), 0);
                  return <Chip label={`Total: ${totalCount}`} size="small" color="primary" />;
                })()}
              </Box>
              {(() => {
                const statusEntries = Object.entries(metrics.appointments_by_status || {});
                const totalCount = statusEntries.reduce((sum, [_, count]) => sum + (count || 0), 0);
                
                if (totalCount === 0) {
                  return (
                    <Box sx={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Typography variant="body2" color="text.secondary">
                        {t("dashboard.noData", { defaultValue: "No data available for this period" })}
                      </Typography>
                    </Box>
                  );
                }
                
                // Order: Total, Active, Completed, No Show, Cancelled
                const activeCount = statusEntries.find(([status]) => status === "ACTIVE")?.[1] || 0;
                const orderedData = [
                  { status: "Total", count: totalCount, originalStatus: "TOTAL", isTotal: true },
                  ...(activeCount > 0 ? [{ status: "Active", count: activeCount, originalStatus: "ACTIVE", isActive: true, isTotal: false }] : []),
                  ...statusEntries
                    .filter(([status]) => status === "COMPLETED")
                    .map(([status, count]) => ({ status: getAppointmentStatusLabel(status), count: count || 0, originalStatus: status, isTotal: false })),
                  ...statusEntries
                    .filter(([status]) => status === "NO_SHOW")
                    .map(([status, count]) => ({ status: getAppointmentStatusLabel(status), count: count || 0, originalStatus: status, isTotal: false })),
                  ...statusEntries
                    .filter(([status]) => status === "CANCELLED")
                    .map(([status, count]) => ({ status: getAppointmentStatusLabel(status), count: count || 0, originalStatus: status, isTotal: false })),
                ];
                
                return (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart 
                      data={orderedData}
                      style={{ cursor: Object.values(metrics.appointments_by_status || {}).some((c: number) => c > 0) ? "pointer" : "default" }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.1)" />
                      <XAxis dataKey="status" />
                      <YAxis />
                      <RechartsTooltip 
                        formatter={(value: any, _name: any, props: any) => {
                          if (props.payload.isTotal) {
                            return [`Total Appointments: ${value}`, ""];
                          }
                          if (props.payload.isActive) {
                            return [`Active Appointments: ${value}`, ""];
                          }
                          return [`${props.payload.status} Appointments: ${value}`, ""];
                        }}
                        separator=""
                        labelFormatter={() => ""}
                      />
                      <Bar
                        dataKey="count"
                        fill="#1d7af3"
                        radius={[8, 8, 0, 0]}
                        // This makes the full column clickable
                        shape={(props: any) => {
                          const { x, y, width, height, payload, background } = props;
                          const isClickable = payload?.count ?? 0 > 0;
                          const handleClick = (e: any) => {
                            e?.stopPropagation?.();
                            // Navigate to appointments page with ALL tab selected, status filter, and date range from trends
                            const status = payload?.originalStatus;
                            const dateRange = getTrendsDateRange();
                            const additionalParams = {
                              date_from: dateRange.from,
                              date_to: dateRange.to,
                            };
                            if (status && status !== "TOTAL") {
                              // For ACTIVE, navigate with all three active statuses
                              if (status === "ACTIVE") {
                                navigate(buildAppointmentUrl(["SCHEDULED", "CHECKED_IN", "IN_CONSULTATION"], additionalParams));
                              } else {
                                navigate(buildAppointmentUrl(status, additionalParams));
                              }
                            } else {
                              navigate(buildAppointmentUrl(null, additionalParams));
                            }
                          };

                          return (
                            <g>
                              {/* Full-height invisible hit area (the "hover band") */}
                              {background ? (
                                <rect
                                  x={background.x}
                                  y={background.y}
                                  width={background.width}
                                  height={background.height}
                                  fill="transparent"
                                  style={{ cursor: isClickable ? "pointer" : "default" }}
                                  onClick={handleClick}
                                />
                              ) : null}

                              {/* Actual visible bar */}
                              <rect
                                x={x}
                                y={y}
                                width={width}
                                height={height}
                                rx={8}
                                ry={8}
                                fill="#1d7af3"
                                onClick={handleClick}
                                style={{ cursor: isClickable ? "pointer" : "default" }}
                              />
                            </g>
                          );
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </Paper>
          </Grid>
        )}

        {/* B3: Prescriptions */}
        {(isPharmacist || isAdmin) && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  {t("dashboard.prescriptionsStatus", { defaultValue: "Prescriptions Status" })} ({getRangeLabel()})
                </Typography>
                {(() => {
                  const statusEntries = Object.entries(metrics.prescriptions_by_status || {});
                  const totalCount = statusEntries.reduce((sum, [_, count]) => sum + (count || 0), 0);
                  return <Chip label={`Total: ${totalCount}`} size="small" color="primary" />;
                })()}
              </Box>
              {(() => {
                const statusEntries = Object.entries(metrics.prescriptions_by_status || {});
                const nonZeroEntries = statusEntries.filter(([_, count]) => (count || 0) > 0);
                const totalCount = statusEntries.reduce((sum, [_, count]) => sum + (count || 0), 0);
                
                if (totalCount === 0 || nonZeroEntries.length === 0) {
                  return (
                    <Box sx={{ height: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
                      <Typography variant="body1" color="text.secondary" fontWeight={500}>
                        {t("dashboard.noData", { defaultValue: "No data available for this period" })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t("dashboard.noPrescriptionData", { defaultValue: "No prescription data to display" })}
                      </Typography>
                    </Box>
                  );
                }
                
                if (nonZeroEntries.length <= 1) {
                  return (
                    <Box sx={{ height: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <Typography variant="body2" color="text.secondary" mb={2}>
                        {t("dashboard.noMeaningfulDistribution", { defaultValue: "No meaningful distribution yet" })}
                      </Typography>
                      {nonZeroEntries.map(([status, count]) => (
                        <Box key={status} sx={{ textAlign: "center" }}>
                          <Typography variant="h5" fontWeight={600}>
                            {count}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {getPrescriptionStatusLabel(status)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  );
                }
                
                return (
                  <Box sx={{ width: "100%", height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={nonZeroEntries.map(([status, count]) => ({
                            name: getPrescriptionStatusLabel(status),
                            value: count,
                            originalStatus: status,
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }: any) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          onClick={(data: any) => {
                            if (data?.originalStatus && data.value > 0) {
                              const range = getTrendsDateRange();
                              navigate(buildPrescriptionUrl(data.originalStatus, range.from, range.to));
                            }
                          }}
                          style={{ cursor: Object.values(metrics.prescriptions_by_status || {}).some((c: number) => c > 0) ? "pointer" : "default" }}
                        >
                          {nonZeroEntries.map(([status], index) => {
                            const color = getPrescriptionStatusColor(status);
                            const colorMap: Record<string, string> = {
                              success: "#00a86b",
                              error: "#f44336",
                              warning: "#ff9800",
                              default: "#9e9e9e",
                              primary: "#1d7af3",
                            };
                            return (
                              <Cell key={`cell-${index}`} fill={colorMap[color] || "#9e9e9e"} />
                            );
                          })}
                        </Pie>
                        <RechartsTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                );
              })()}
            </Paper>
          </Grid>
        )}

        {/* Patients (breakdown) */}
        {isAdmin && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  {t("dashboard.patientsByGender", { defaultValue: "Patients By Gender" })} ({getRangeLabel()})
                </Typography>
                {(() => {
                  const genderEntries = Object.entries(metrics.patient_gender_distribution || {});
                  const totalCount = genderEntries.reduce((sum, [_, count]) => sum + (count || 0), 0);
                  return <Chip label={`Total: ${totalCount}`} size="small" color="primary" />;
                })()}
              </Box>
              {(() => {
                const genderEntries = Object.entries(metrics.patient_gender_distribution || {});
                const nonZeroEntries = genderEntries.filter(([_, count]) => (count || 0) > 0);
                const totalCount = genderEntries.reduce((sum, [_, count]) => sum + (count || 0), 0);
                
                if (totalCount === 0 || nonZeroEntries.length === 0) {
                  return (
                    <Box sx={{ height: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
                      <Typography variant="body1" color="text.secondary" fontWeight={500}>
                        {t("dashboard.noData", { defaultValue: "No data available for this period" })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t("dashboard.noGenderData", { defaultValue: "No patient gender data to display" })}
                      </Typography>
                    </Box>
                  );
                }
                
                if (nonZeroEntries.length <= 1) {
                  return (
                    <Box sx={{ height: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <Typography variant="body2" color="text.secondary" mb={2}>
                        {t("dashboard.noMeaningfulDistribution", { defaultValue: "No meaningful distribution yet" })}
                      </Typography>
                      {nonZeroEntries.map(([gender, count]) => (
                        <Box key={gender} sx={{ textAlign: "center" }}>
                          <Typography variant="h5" fontWeight={600}>
                            {count}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {gender === "MALE" ? t("patients.genderMale", { defaultValue: "Male" }) :
                             gender === "FEMALE" ? t("patients.genderFemale", { defaultValue: "Female" }) :
                             gender === "OTHER" ? t("patients.genderOther", { defaultValue: "Other" }) :
                             t("patients.genderUnknown", { defaultValue: "Unknown" })}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  );
                }
                
                return (
                  <Box sx={{ width: "100%", height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={nonZeroEntries.map(([gender, count]) => ({
                            name: gender === "MALE" ? t("patients.genderMale", { defaultValue: "Male" }) :
                                  gender === "FEMALE" ? t("patients.genderFemale", { defaultValue: "Female" }) :
                                  gender === "OTHER" ? t("patients.genderOther", { defaultValue: "Other" }) :
                                  t("patients.genderUnknown", { defaultValue: "Unknown" }),
                            value: count || 0,
                            originalGender: gender,
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }: any) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          onClick={(data: any) => {
                            if (data?.originalGender && data.value > 0) {
                              const range = getTrendsDateRange();
                              navigate(`${AppRoutes.PATIENTS}?gender=${data.originalGender}&registered_from=${range.from}&registered_to=${range.to}`);
                            }
                          }}
                          style={{ cursor: Object.values(metrics.patient_gender_distribution || {}).some(c => (c || 0) > 0) ? "pointer" : "default" }}
                        >
                          {nonZeroEntries.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={["#1d7af3", "#00a86b", "#ff9800", "#9e9e9e"][index % 4]} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                );
              })()}
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Section C: Quality / Exceptions */}
      {(isAdmin || isReceptionist) && (
        <>
          <Typography variant="h5" fontWeight={600} sx={{ mt: 3, mb: 2 }}>
            {t("dashboard.qualityExceptions", { defaultValue: "Quality / Exceptions" })}
          </Typography>
          
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* C1: No Show Risk */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper 
                elevation={2} 
                sx={{ 
                  p: 3, 
                  borderRadius: 3,
                  border: (metrics.no_show_risk_count || 0) > 0 ? "2px solid #ff9800" : "1px solid rgba(0, 0, 0, 0.05)",
                  bgcolor: (metrics.no_show_risk_count || 0) > 0 ? "rgba(255, 152, 0, 0.05)" : "background.paper",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                  <WarningIcon color={(metrics.no_show_risk_count || 0) > 0 ? "warning" : "disabled"} />
                  <Tooltip 
                    title={t("dashboard.noShowRiskDescription", { 
                      defaultValue: "Appointments past scheduled time + grace window, still scheduled or marked no-show" 
                    })} 
                    arrow
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Typography variant="h6" fontWeight={600}>
                        {t("dashboard.noShowRisk", { defaultValue: "No Show Risk / Missed Visits" })}
                      </Typography>
                      <InfoIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                    </Box>
                  </Tooltip>
                </Box>
                <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography 
                    variant="h4" 
                    fontWeight={700} 
                    color={(metrics.no_show_risk_count || 0) > 0 ? "warning.main" : "text.secondary"}
                    sx={{
                      cursor: (metrics.no_show_risk_count || 0) > 0 ? "pointer" : "default",
                      transition: "all 0.2s ease",
                      "&:hover": (metrics.no_show_risk_count || 0) > 0 ? { transform: "scale(1.05)" } : {},
                    }}
                    onClick={(metrics.no_show_risk_count || 0) > 0 ? () => {
                      // No Show Risk: appointments past scheduled time + grace window (30 min)
                      // Backend filters by scheduled_at < (now - 30 minutes) and status IN [SCHEDULED, NO_SHOW]
                      // We just need to pass the status filter - backend handles the time-based filtering
                      navigate(buildAppointmentUrl(["SCHEDULED", "NO_SHOW"]));
                    } : undefined}
                  >
                    {metrics.no_show_risk_count || 0}
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            {/* C2: Incomplete Clinical Notes */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper 
                elevation={2} 
                sx={{ 
                  p: 3, 
                  borderRadius: 3,
                  border: (metrics.incomplete_clinical_notes || 0) > 0 ? "2px solid #ff9800" : "1px solid rgba(0, 0, 0, 0.05)",
                  bgcolor: (metrics.incomplete_clinical_notes || 0) > 0 ? "rgba(255, 152, 0, 0.05)" : "background.paper",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                  <AssignmentIcon color={(metrics.incomplete_clinical_notes || 0) > 0 ? "warning" : "disabled"} />
                  <Tooltip 
                    title={t("dashboard.incompleteClinicalNotesDescription", { 
                      defaultValue: "OPD consultations started but no prescription created and past grace window" 
                    })} 
                    arrow
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Typography variant="h6" fontWeight={600}>
                        {t("dashboard.incompleteClinicalNotes", { defaultValue: "Unsigned / Incomplete Clinical Notes" })}
                      </Typography>
                      <InfoIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                    </Box>
                  </Tooltip>
                </Box>
                <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography 
                    variant="h4" 
                    fontWeight={700} 
                    color={(metrics.incomplete_clinical_notes || 0) > 0 ? "warning.main" : "text.secondary"}
                    sx={{
                      cursor: (metrics.incomplete_clinical_notes || 0) > 0 ? "pointer" : "default",
                      transition: "all 0.2s ease",
                      "&:hover": (metrics.incomplete_clinical_notes || 0) > 0 ? { transform: "scale(1.05)" } : {},
                    }}
                    onClick={(metrics.incomplete_clinical_notes || 0) > 0 ? () => navigate(`${AppRoutes.APPOINTMENTS}?segment=ALL`) : undefined}
                  >
                    {metrics.incomplete_clinical_notes || 0}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default DashboardPage;
