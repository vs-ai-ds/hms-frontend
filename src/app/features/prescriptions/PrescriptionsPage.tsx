//src/app/features/prescriptions/PrescriptionsPage.tsx
import React from "react";
import {
  Box,
  Button,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Chip,
  Select,
  MenuItem,
  CircularProgress,
  TablePagination,
  TextField,
  FormControl,
  InputLabel,
  Paper,
  Grid,
  Divider,
  IconButton,
  Dialog,
  Tooltip,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from "@mui/material";
import {
  Add as AddIcon,
  Inbox as EmptyIcon,
  Close as CloseIcon,
  LocalPharmacy as LocalPharmacyIcon,
  Print as PrintIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";
import TableSortLabel from "@mui/material/TableSortLabel";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom"; // Only for appointment_id, not filters

import PageToolbar from "@app/components/common/PageToolbar";
import {
  fetchPrescriptions,
  updatePrescriptionStatus,
  getPrescription,
  dispensePrescription,
  Prescription,
} from "@app/lib/api/prescriptions";
import PrescriptionFormDialog from "./PrescriptionFormDialog";
import IssuePrescriptionDialog from "./IssuePrescriptionDialog";
import PrescriptionPrintView from "@app/components/prescriptions/PrescriptionPrintView";
import AppointmentDetailDialog from "@app/components/appointments/AppointmentDetailDialog";

import { useAuthStore } from "@app/store/authStore";
import { can } from "@app/lib/abac";
import { useTranslation } from "react-i18next";
import { useToast } from "@app/components/common/ToastProvider";
import { apiClient } from "@app/lib/apiClient";
import {
  getPrescriptionStatusLabel,
  getPrescriptionStatusColor,
  getAppointmentStatusLabel,
  getAppointmentStatusColor,
} from "@app/lib/utils/statusUtils";
import { getAppointment } from "@app/lib/api/appointments";

const PRINT_ROOT_ID = "rx-print-root";

/**
 * Print-only CSS:
 * - hides whole app while printing
 * - shows only the prescription print root
 */
function ensurePrintStyles() {
  const styleId = "rx-print-style";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.innerHTML = `
    @media print {
      body * { visibility: hidden !important; }
      #${PRINT_ROOT_ID}, #${PRINT_ROOT_ID} * { visibility: visible !important; }
      #${PRINT_ROOT_ID} { position: absolute; left: 0; top: 0; width: 100%; }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Distribute icons into rows based on count:
 * - 1-3 icons: all in line 1
 * - 4 icons: 2 in line 1, 2 in line 2
 * - 5 icons: 3 in line 1, 2 in line 2
 * - 6+ icons: 3 in line 1, rest in line 2
 */
function distributeIconsIntoRows<T>(icons: T[]): [T[], T[]] {
  if (icons.length <= 3) {
    return [icons, []];
  } else if (icons.length === 4) {
    return [icons.slice(0, 2), icons.slice(2)];
  } else if (icons.length === 5) {
    return [icons.slice(0, 3), icons.slice(3)];
  } else {
    // 6 or more: 3 in first line, rest in second
    return [icons.slice(0, 3), icons.slice(3)];
  }
}

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


const PrescriptionsPage: React.FC = () => {
  // Read URL params for navigation from dashboard
  const [searchParams] = useSearchParams();
  const appointmentIdFromUrl = searchParams.get("appointment_id");
  const initialStatus = searchParams.get("status") || "open";
  const initialDateFrom = searchParams.get("date_from") || "";
  const initialDateTo = searchParams.get("date_to") || "";

  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();

  const [openDialog, setOpenDialog] = React.useState(false);

  // Local state for filters, search, pagination
  // Prescriptions are workflow-driven by status, so default view shows items that need action (Draft + Issued).
  const [search, setSearch] = React.useState("");
  const [visitTypeFilter, setVisitTypeFilter] = React.useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("all");
  const [doctorFilter, setDoctorFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>(initialStatus); // Use URL param or default: "open" = DRAFT + ISSUED
  const [dateFromFilter, setDateFromFilter] = React.useState<string>(initialDateFrom); // Use URL param
  const [dateToFilter, setDateToFilter] = React.useState<string>(initialDateTo); // Use URL param

  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [orderBy, setOrderBy] = React.useState<"created_at" | "">("");
  const [order, setOrder] = React.useState<"asc" | "desc">("desc");

  const [selectedPrescription, setSelectedPrescription] = React.useState<string | null>(null);

  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  const [printDialogOpen, setPrintDialogOpen] = React.useState(false);

  const [issueDialogOpen, setIssueDialogOpen] = React.useState(false);
  const [prescriptionToIssue, setPrescriptionToIssue] = React.useState<any>(null);

  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [prescriptionToCancel, setPrescriptionToCancel] = React.useState<any>(null);
  const [cancelReason, setCancelReason] = React.useState("");

  const [appointmentDetailOpen, setAppointmentDetailOpen] = React.useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = React.useState<string | null>(null);

  const [dispenseDialogOpen, setDispenseDialogOpen] = React.useState(false);
  const [prescriptionToDispense, setPrescriptionToDispense] = React.useState<any>(null);

  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [prescriptionToEdit, setPrescriptionToEdit] = React.useState<any>(null);

  // Permissions
  const canViewUsers = user ? can(user, "users:view") : false;
  const canViewDepartments = user ? can(user, "departments:view") : false;

  const canCreate = user ? can(user, "prescriptions:create") : false;
  const canIssue = user ? (can(user, "prescriptions:issue") || can(user, "prescriptions:update_status")) : false;
  const canDispense =
    user
      ? (can(user, "prescriptions:dispense") ||
          (can(user, "prescriptions:update_status") &&
            (user?.roles?.some((r: any) => r.name === "PHARMACIST") ||
              user?.roles?.some((r: any) => r.name === "HOSPITAL_ADMIN"))))
      : false;
  const canEdit = user ? can(user, "prescriptions:create") : false;
  const canCancel = user ? (can(user, "prescriptions:cancel") || can(user, "prescriptions:update_status")) : false;

  // Doctors list (for filter)
  const { data: doctors } = useQuery({
    queryKey: ["users", "doctors-for-filter"],
    queryFn: async () => {
      const res = await apiClient.get("/users");
      return (res.data || []).filter((u: any) => u.roles?.some((r: any) => r.name === "DOCTOR"));
    },
    enabled: canViewUsers,
    staleTime: 60_000,
  });

  // Departments list (for filter)
  const { data: departments } = useQuery({
    queryKey: ["departments", "for-filter"],
    queryFn: async () => (await apiClient.get("/departments")).data,
    enabled: canViewDepartments,
    staleTime: 60_000,
  });


  const { data, isLoading } = useQuery<Prescription[]>({
    queryKey: [
      "prescriptions",
      {
        search,
        visitTypeFilter,
        departmentFilter,
        doctorFilter,
        statusFilter,
        dateFromFilter,
        dateToFilter,
        appointmentIdFromUrl,
        page,
        rowsPerPage,
        orderBy,
        order,
      },
    ],
    queryFn: () => {
      // Map status filter to API format
      // "open" = DRAFT,ISSUED (comma-separated for API)
      // "all" = no status filter
      // Single status = pass as-is
      let statusParam: string | undefined;
      if (statusFilter === "open") {
        statusParam = "DRAFT,ISSUED";
      } else if (statusFilter !== "all") {
        statusParam = statusFilter;
      }
      
      // Build order_by parameter
      let orderByParam: string | undefined;
      if (orderBy === "created_at") {
        orderByParam = order === "asc" ? "created_at_asc" : "created_at_desc";
      }

      return fetchPrescriptions({
        appointment_id: appointmentIdFromUrl || undefined,
        visit_type: visitTypeFilter !== "all" ? visitTypeFilter : undefined,
        department_id: departmentFilter !== "all" ? departmentFilter : undefined,
        doctor_user_id: doctorFilter !== "all" ? doctorFilter : undefined,
        status: statusParam,
        date_from: dateFromFilter || undefined,
        date_to: dateToFilter || undefined,
        order_by: orderByParam,
        page: page + 1,
        page_size: rowsPerPage,
      });
    },
  });

  const { data: prescriptionDetail } = useQuery({
    queryKey: ["prescription", selectedPrescription],
    queryFn: () => (selectedPrescription ? getPrescription(selectedPrescription) : null),
    enabled: !!selectedPrescription && (detailDialogOpen || printDialogOpen),
  });

  // Patient data for detail dialog
  const { data: prescriptionPatient } = useQuery({
    queryKey: ["patient", "for-prescription-detail", prescriptionDetail?.patient_id],
    queryFn: async () => {
      if (!prescriptionDetail?.patient_id) return null;
      const res = await apiClient.get(`/patients/${prescriptionDetail.patient_id}`);
      return res.data;
    },
    enabled: !!prescriptionDetail?.patient_id && detailDialogOpen,
  });

  // Tenant info for print view
  const { data: tenantInfo } = useQuery({
    queryKey: ["tenant", "for-print"],
    queryFn: async () => {
      try {
        const res = await apiClient.get("/auth/me");
        return res.data?.tenant || null;
      } catch {
        return null;
      }
    },
    enabled: !!user?.tenant_id && printDialogOpen,
  });

  // Appointment associated with prescription (for detail)
  const { data: prescriptionAppointment } = useQuery({
    queryKey: ["appointment", "for-prescription-detail", prescriptionDetail?.appointment_id],
    queryFn: () => (prescriptionDetail?.appointment_id ? getAppointment(prescriptionDetail.appointment_id) : null),
    enabled: !!prescriptionDetail?.appointment_id && detailDialogOpen,
  });

  // Note: Appointment detail is now handled by AppointmentDetailDialog component

  // Status mutation - child dialogs (IssuePrescriptionDialog) handle API calls and success toasts
  // Parent only needs to close dialog and refresh data
  const statusMutation = useMutation({
    mutationFn: (vars: { id: string; status: string; options?: any; prescription?: Prescription }) =>
      updatePrescriptionStatus(vars.id, vars.status, vars.options),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      queryClient.invalidateQueries({ queryKey: ["prescription", selectedPrescription] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      
      // Success toast is shown in child dialogs (IssuePrescriptionDialog, etc.)
      // For non-ISSUED status changes, show toast here (cancelled, etc.)
      if (variables.status !== "ISSUED") {
        const prescription = variables.prescription || data;
        const patientName = prescription.patient_name || "Patient";
        const prescriptionCode = prescription.prescription_code || prescription.id.substring(0, 8);
        
        let message = "";
        if (variables.status === "CANCELLED") {
          message = t("prescriptions.cancelledSuccessDetailed", {
            defaultValue: "Prescription {{code}} for {{name}} has been cancelled.",
            code: prescriptionCode,
            name: patientName,
          });
        } else {
          message = t("notifications.prescriptionStatusUpdated", {
            defaultValue: "Prescription {{code}} status updated successfully.",
            code: prescriptionCode,
          });
        }
        
        showSuccess(message);
      }
      
      setIssueDialogOpen(false);
      setPrescriptionToIssue(null);
    },
    onError: (error: any) => {
      showError(
        error?.response?.data?.detail ||
          t("notifications.prescriptionStatusUpdateError", { defaultValue: "Failed to update prescription status" })
      );
    },
  });

  const dispenseMutation = useMutation({
    mutationFn: (vars: { id: string; prescription?: Prescription }) => dispensePrescription(vars.id),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      queryClient.invalidateQueries({ queryKey: ["prescription", selectedPrescription] });
      
      const prescription = variables.prescription || data;
      const patientName = prescription.patient_name || "Patient";
      const prescriptionCode = prescription.prescription_code || prescription.id.substring(0, 8);
      
      const message = t("prescriptions.dispensedSuccessDetailed", {
        defaultValue: `Prescription ${prescriptionCode} has been dispensed for ${patientName}. Stock quantities have been deducted.`,
        prescriptionCode,
        patientName,
      });
      
      showSuccess(message);
      setDispenseDialogOpen(false);
      setPrescriptionToDispense(null);
    },
    onError: (error: any) => {
      showError(
        error?.response?.data?.detail || t("prescriptions.dispenseError", { defaultValue: "Failed to dispense prescription" })
      );
    },
  });

  const prescriptions = data ?? [];

  // Batch patient fetch (still N+1 but cached)
  const uniquePatientIds = React.useMemo(() => {
    return Array.from(new Set(prescriptions.map((p) => p.patient_id).filter(Boolean)));
  }, [prescriptions]);

  const { data: patientsMap } = useQuery({
    queryKey: ["patients", "batch-by-id", uniquePatientIds.join(",")],
    queryFn: async () => {
      if (uniquePatientIds.length === 0) return {};
      const map: Record<string, any> = {};
      await Promise.all(
        uniquePatientIds.map(async (pid) => {
          try {
            const res = await apiClient.get(`/patients/${pid}`);
            map[pid] = res.data;
          } catch {
            map[pid] = null;
          }
        })
      );
      return map;
    },
    enabled: uniquePatientIds.length > 0,
    staleTime: 60_000,
  });

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return prescriptions;

    return prescriptions.filter((p) => {
      const meds = ((p as any).medicines || [])
        .map((m: any) => m?.name || "")
        .filter(Boolean)
        .join(", ")
        .toLowerCase();

      const itemsText = (p.items || []).map((it: any) => it?.medicine_name || it?.name || "").join(", ").toLowerCase();

      return (
        (p.patient_name ?? "").toLowerCase().includes(q) ||
        (p.doctor_name ?? "").toLowerCase().includes(q) ||
        (p.diagnosis ?? "").toLowerCase().includes(q) ||
        meds.includes(q) ||
        itemsText.includes(q)
      );
    });
  }, [prescriptions, search]);

  const paged = React.useMemo(() => {
    return filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const closeDetailDialog = () => {
    setDetailDialogOpen(false);
    setSelectedPrescription(null);
  };

  const openPrintDialogFor = (id: string) => {
    ensurePrintStyles();
    setSelectedPrescription(id);
    setPrintDialogOpen(true);
  };

  return (
    <Box>
      <PageToolbar
        title={t("prescriptions.title", { defaultValue: "Prescriptions" })}
        subtitle={t("prescriptions.subtitle", {
          defaultValue: "Manage digital prescriptions, medicines, and pharmacy orders.",
        })}
        titleIcon={<LocalPharmacyIcon sx={{ fontSize: 32 }} />}
        searchPlaceholder={t("prescriptions.searchPlaceholder", {
          defaultValue: "Search by patient, doctor, diagnosis, medicines...",
        })}
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(0);
        }}
        primaryAction={
          canCreate
            ? {
                label: t("prescriptions.create", { defaultValue: "Create Prescription" }),
                onClick: () => setOpenDialog(true),
                icon: <AddIcon />,
              }
            : undefined
        }
      />

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap", alignItems: "center" }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>{t("prescriptions.visitType", { defaultValue: "Visit Type" })}</InputLabel>
          <Select
            value={visitTypeFilter}
            label={t("prescriptions.visitType", { defaultValue: "Visit Type" })}
            onChange={(e) => {
              setVisitTypeFilter(e.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="all">{t("common.all", { defaultValue: "All" })}</MenuItem>
            <MenuItem value="OPD">OPD</MenuItem>
            <MenuItem value="IPD">IPD</MenuItem>
          </Select>
        </FormControl>

        {/* Department filter only if allowed */}
        {canViewDepartments && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>{t("prescriptions.department", { defaultValue: "Department" })}</InputLabel>
            <Select
              value={departmentFilter}
              label={t("prescriptions.department", { defaultValue: "Department" })}
              onChange={(e) => {
                const newValue = e.target.value;
                setDepartmentFilter(newValue);
                setPage(0);
              }}
            >
              <MenuItem value="all">{t("common.all", { defaultValue: "All" })}</MenuItem>
              {(departments || []).map((dept: any) => (
                <MenuItem key={dept.id} value={dept.id}>
                  {dept.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Doctor filter only if allowed */}
        {canViewUsers && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>{t("prescriptions.doctor", { defaultValue: "Doctor" })}</InputLabel>
            <Select
              value={doctorFilter}
              label={t("prescriptions.doctor", { defaultValue: "Doctor" })}
              onChange={(e) => {
                const newValue = e.target.value;
                setDoctorFilter(newValue);
                setPage(0);
              }}
            >
              <MenuItem value="all">{t("common.all", { defaultValue: "All" })}</MenuItem>
              {(doctors || []).map((doctor: any) => (
                <MenuItem key={doctor.id} value={doctor.id}>
                  {`${doctor.first_name} ${doctor.last_name}`.trim()}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>{t("prescriptions.status", { defaultValue: "Status" })}</InputLabel>
          <Select
            value={statusFilter}
            label={t("prescriptions.status", { defaultValue: "Status" })}
            onChange={(e) => {
              const newValue = e.target.value;
              setStatusFilter(newValue);
              setPage(0);
            }}
          >
            <MenuItem value="open">
              {t("prescriptions.openNeedsAction", { defaultValue: "Open / Needs action" })}
            </MenuItem>
            <MenuItem value="DRAFT">
              {t("prescriptions.draft", { defaultValue: "Draft" })}
            </MenuItem>
            <MenuItem value="ISSUED">
              {t("prescriptions.issued", { defaultValue: "Issued" })}
            </MenuItem>
            <MenuItem value="DISPENSED">
              {t("prescriptions.dispensed", { defaultValue: "Dispensed" })}
            </MenuItem>
            <MenuItem value="CANCELLED">
              {t("prescriptions.cancelled", { defaultValue: "Cancelled" })}
            </MenuItem>
            <MenuItem value="all">{t("common.all", { defaultValue: "All statuses" })}</MenuItem>
          </Select>
        </FormControl>

        <TextField
          size="small"
          type="date"
          label={t("prescriptions.dateFrom", { defaultValue: "Date From" })}
          value={dateFromFilter}
          onChange={(e) => {
            const newFrom = e.target.value;
            setDateFromFilter(newFrom);
            if (dateToFilter && newFrom && dateToFilter < newFrom) {
              setDateToFilter("");
            }
            setPage(0);
          }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 180 }}
        />

        <TextField
          size="small"
          type="date"
          label={t("prescriptions.dateTo", { defaultValue: "Date To" })}
          value={dateToFilter}
          onChange={(e) => {
            const newTo = e.target.value;
            if (dateFromFilter && newTo && newTo < dateFromFilter) {
              showError(t("prescriptions.dateToBeforeDateFrom", { defaultValue: "Date To cannot be before Date From" }));
              return;
            }
            setDateToFilter(newTo);
            setPage(0);
          }}
          InputLabelProps={{ shrink: true }}
          inputProps={{ min: dateFromFilter || undefined }}
          sx={{ minWidth: 180 }}
        />
      </Box>

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
                    {paged.some((p: any) => p.prescription_code || p.id) && (
                      <TableCell>{t("prescriptions.prescriptionId", { defaultValue: "ID" })}</TableCell>
                    )}
                    <TableCell>{t("prescriptions.patient", { defaultValue: "Patient" })}</TableCell>
                    <TableCell>{t("prescriptions.doctor", { defaultValue: "Doctor" })}</TableCell>
                    <TableCell>{t("prescriptions.diagnosis", { defaultValue: "Diagnosis" })}</TableCell>
                    <TableCell>{t("prescriptions.medicines", { defaultValue: "Medicines" })}</TableCell>
                    <TableCell>{t("prescriptions.status", { defaultValue: "Status" })}</TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={orderBy === "created_at"}
                        direction={orderBy === "created_at" ? order : "desc"}
                        onClick={() => {
                          if (orderBy === "created_at") {
                            setOrder(order === "asc" ? "desc" : "asc");
                          } else {
                            setOrderBy("created_at");
                            setOrder("desc");
                          }
                          setPage(0); // Reset to first page when sorting changes
                        }}
                      >
                        {t("common.createdAt", { defaultValue: "Created At" })}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">{t("common.actions", { defaultValue: "Actions" })}</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {paged.map((p) => (
                    <TableRow
                      key={p.id}
                      hover
                      onClick={() => {
                        setSelectedPrescription(p.id);
                        setDetailDialogOpen(true);
                      }}
                      sx={{ cursor: "pointer" }}
                    >
                      {paged.some((presc: any) => presc.prescription_code || presc.id) && (
                        <TableCell>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                            {p.prescription_code || p.id.substring(0, 8)}
                          </Typography>
                        </TableCell>
                      )}

                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {p.patient_name || "-"}
                          </Typography>

                          {patientsMap?.[p.patient_id]?.patient_code && (
                            <Typography variant="caption" color="text.secondary">
                              {patientsMap[p.patient_id].patient_code}
                            </Typography>
                          )}

                          {/* Visit type chip */}
                          <Box sx={{ mt: 0.5, display: "flex", gap: 0.5, alignItems: "center" }}>
                            {(() => {
                              const visitType = p.visit_type || (p.appointment_id ? "OPD" : p.admission_id ? "IPD" : "Walk-In");
                              if (visitType === "OPD" && p.appointment_id) {
                                return (
                                  <Chip
                                    label="OPD"
                                    size="small"
                                    color="info"
                                    sx={{ height: 18, fontSize: "0.65rem", cursor: "pointer" }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedAppointmentId(p.appointment_id!);
                                      setAppointmentDetailOpen(true);
                                    }}
                                  />
                                );
                              }
                              if (visitType === "IPD") {
                                return <Chip label="IPD" size="small" color="primary" sx={{ height: 18, fontSize: "0.65rem" }} />;
                              }
                              return <Chip label="Walk-In" size="small" color="default" sx={{ height: 18, fontSize: "0.65rem" }} />;
                            })()}
                          </Box>
                        </Box>
                      </TableCell>

                      <TableCell>{p.doctor_name || "-"}</TableCell>

                      <TableCell>
                        {p.diagnosis ? (p.diagnosis.length > 50 ? `${p.diagnosis.substring(0, 50)}...` : p.diagnosis) : "-"}
                      </TableCell>

                      <TableCell>
                        {p.items && p.items.length > 0 ? (
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              {p.items.length}{" "}
                              {p.items.length === 1
                                ? t("prescriptions.medicine", { defaultValue: "med" })
                                : t("prescriptions.medicines", { defaultValue: "meds" })}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200, display: "block" }}>
                              {p.items.slice(0, 2).map((item: any) => item.medicine_name || item.name).join(", ")}
                              {p.items.length > 2 && "..."}
                            </Typography>
                          </Box>
                        ) : (p as any).medicines && (p as any).medicines.length > 0 ? (
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              {(p as any).medicines.length}{" "}
                              {(p as any).medicines.length === 1
                                ? t("prescriptions.medicine", { defaultValue: "med" })
                                : t("prescriptions.medicines", { defaultValue: "meds" })}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200, display: "block" }}>
                              {(p as any).medicines
                                .slice(0, 2)
                                .map((m: any) => m?.name || m?.medicine_name || "")
                                .filter(Boolean)
                                .join(", ")}
                              {(p as any).medicines.length > 2 && "..."}
                            </Typography>
                          </Box>
                        ) : (
                          "-"
                        )}
                      </TableCell>

                      <TableCell>
                        <Chip
                          label={getPrescriptionStatusLabel(p.status)}
                          size="small"
                          color={getPrescriptionStatusColor(p.status)}
                          sx={{ borderRadius: 2 }}
                        />
                      </TableCell>

                      <TableCell>
                        {new Date(p.created_at).toLocaleString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>

                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          // Collect all action icons
                          const actionIcons: React.ReactNode[] = [];

                          // View icon (always shown)
                          actionIcons.push(
                            <Tooltip key="view" title={t("common.view", { defaultValue: "View Details" })}>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setSelectedPrescription(p.id);
                                  setDetailDialogOpen(true);
                                }}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          );

                          // Print icon
                          actionIcons.push(
                            <Tooltip
                              key="print"
                              title={
                                ["ISSUED", "DISPENSED"].includes(p.status)
                                  ? t("prescriptions.print", { defaultValue: "Print" })
                                  : t("prescriptions.printDisabled", {
                                      defaultValue: "Prescription can be printed only after it is issued.",
                                    })
                              }
                            >
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={!["ISSUED", "DISPENSED"].includes(p.status)}
                                  onClick={() => openPrintDialogFor(p.id)}
                                >
                                  <PrintIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          );

                          // Edit icon
                          if (canEdit && p.status === "DRAFT") {
                            actionIcons.push(
                              <Tooltip key="edit" title={t("prescriptions.edit", { defaultValue: "Edit" })}>
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => {
                                    setPrescriptionToEdit(p);
                                    setEditDialogOpen(true);
                                  }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            );
                          }

                          // Issue icon
                          if (canIssue && p.status === "DRAFT") {
                            actionIcons.push(
                              <Tooltip key="issue" title={t("prescriptions.issue", { defaultValue: "Issue Prescription" })}>
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => {
                                    setPrescriptionToIssue(p);
                                    setIssueDialogOpen(true);
                                  }}
                                >
                                  <CheckCircleIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            );
                          }

                          // Dispense icon
                          if (canDispense && p.status === "ISSUED") {
                            actionIcons.push(
                              <Tooltip key="dispense" title={t("prescriptions.dispense", { defaultValue: "Dispense" })}>
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => {
                                    setPrescriptionToDispense(p);
                                    setDispenseDialogOpen(true);
                                  }}
                                  disabled={dispenseMutation.isPending}
                                >
                                  <LocalPharmacyIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            );
                          }

                          // Cancel icon
                          if (canCancel && p.status === "DRAFT") {
                            actionIcons.push(
                              <Tooltip key="cancel" title={t("prescriptions.cancel", { defaultValue: "Cancel" })}>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    setPrescriptionToCancel(p);
                                    setCancelDialogOpen(true);
                                  }}
                                >
                                  <CancelIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            );
                          }

                          // Distribute icons into rows
                          const [row1, row2] = distributeIconsIntoRows(actionIcons);

                          return (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, alignItems: "flex-end" }}>
                              {row1.length > 0 && (
                                <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center", width: "100%" }}>
                                  {row1}
                                </Box>
                              )}
                              {row2.length > 0 && (
                                <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center", width: "100%" }}>
                                  {row2}
                                </Box>
                              )}
                            </Box>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  ))}

                  {paged.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                        <EmptyIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2, opacity: 0.5 }} />
                        <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                          {t("prescriptions.empty", { defaultValue: "No prescriptions found" })}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t("prescriptions.emptyDescription", {
                            defaultValue: search ? "Try adjusting your search criteria." : "Get started by creating your first prescription.",
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
              count={filtered.length}
              page={page}
              onPageChange={(_e, newPage) => {
                setPage(newPage);
              }}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                const newRowsPerPage = parseInt(e.target.value, 10);
                setRowsPerPage(newRowsPerPage);
                setPage(0);
              }}
              rowsPerPageOptions={[10, 20, 50, 100]}
            />
          </>
        )}
      </Paper>

      {/* Create */}
      <PrescriptionFormDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onCreated={() => {
          setOpenDialog(false);
          // Fire-and-forget: invalidate queries after modal closes
          queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
        }}
        onExistingRxFound={(prescriptionId) => {
          setSelectedPrescription(prescriptionId);
          setDetailDialogOpen(true);
          queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
        }}
      />

      {/* Edit */}
      {prescriptionToEdit && (
        <PrescriptionFormDialog
          open={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            setPrescriptionToEdit(null);
          }}
          onCreated={() => {
            setEditDialogOpen(false);
            setPrescriptionToEdit(null);
            // Fire-and-forget: invalidate queries after modal closes
            queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
          }}
          initialPrescriptionId={prescriptionToEdit.id}
        />
      )}

      {/* Detail */}
      <Dialog open={detailDialogOpen} onClose={closeDetailDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="h6">
              {t("prescriptions.details", { defaultValue: "Prescription Details" })}
              {prescriptionDetail?.prescription_code && (
                <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  (ID: {prescriptionDetail.prescription_code})
                </Typography>
              )}
            </Typography>

            <IconButton onClick={closeDetailDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {prescriptionDetail ? (
            <>
              <Divider sx={{ mb: 2, mt: 1 }} />
              <Grid container spacing={3}>
                {/* Patient Info - Full Width */}
                <Grid size={{ xs: 12 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      {t("prescriptions.patientInfo", { defaultValue: "Patient Information" })}
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    <Grid container spacing={2}>
                      {/* Row 1: Patient and Gender */}
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t("prescriptions.patient", { defaultValue: "Patient" })}
                        </Typography>
                        <Typography variant="body1" fontWeight={500}>
                          {prescriptionDetail.patient_name ||
                            (prescriptionPatient?.first_name
                              ? `${prescriptionPatient.first_name || ""} ${prescriptionPatient.last_name || ""}`.trim()
                              : "-")}

                          {prescriptionPatient?.patient_code && (
                            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                              ({prescriptionPatient.patient_code})
                            </Typography>
                          )}
                        </Typography>
                      </Grid>

                      {prescriptionPatient?.gender && (
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant="caption" color="text.secondary">
                            {t("patients.gender", { defaultValue: "Gender" })}
                          </Typography>
                          <Typography variant="body1">
                            {prescriptionPatient.gender.charAt(0).toUpperCase() + prescriptionPatient.gender.slice(1).toLowerCase()}
                          </Typography>
                        </Grid>
                      )}

                      {/* Row 2: Contact and Address */}
                      {prescriptionPatient && (
                        <>
                          {(prescriptionPatient.phone_primary || prescriptionPatient.email) && (
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Typography variant="caption" color="text.secondary">
                                {t("patients.contact", { defaultValue: "Contact" })}
                              </Typography>
                              <Typography variant="body1">
                                {prescriptionPatient.phone_primary && (
                                  <>
                                    {t("patients.phone", { defaultValue: "Phone" })}: {prescriptionPatient.phone_primary}
                                  </>
                                )}
                                {prescriptionPatient.phone_primary && prescriptionPatient.email && " • "}
                                {prescriptionPatient.email && (
                                  <>
                                    {t("patients.email", { defaultValue: "Email" })}: {prescriptionPatient.email}
                                  </>
                                )}
                              </Typography>
                            </Grid>
                          )}

                          {(prescriptionPatient.city || prescriptionPatient.state) && (
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Typography variant="caption" color="text.secondary">
                                {t("patients.address", { defaultValue: "Address" })}
                              </Typography>
                              <Typography variant="body1">
                                {prescriptionPatient.state
                                  ? `${prescriptionPatient.city || ""}, ${prescriptionPatient.state}`.replace(/^,\s*|,\s*$/g, "")
                                  : prescriptionPatient.city || "-"}
                              </Typography>
                            </Grid>
                          )}
                        </>
                      )}
                    </Grid>
                  </Paper>
                </Grid>

                {/* Prescription Info */}
                <Grid size={{ xs: 12 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      {t("prescriptions.prescriptionInformation", { defaultValue: "Prescription Information" })}
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t("prescriptions.status", { defaultValue: "Status" })}
                        </Typography>
                        <Box sx={{ mt: 0.5 }}>
                          <Chip
                            label={getPrescriptionStatusLabel(prescriptionDetail.status)}
                            size="small"
                            color={getPrescriptionStatusColor(prescriptionDetail.status)}
                            sx={{ borderRadius: 2 }}
                          />
                        </Box>
                      </Grid>
                      {["ISSUED", "DISPENSED"].includes(prescriptionDetail.status) && (
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<PrintIcon />}
                            onClick={() => {
                              closeDetailDialog();
                              openPrintDialogFor(prescriptionDetail.id);
                            }}
                          >
                            {t("prescriptions.print", { defaultValue: "Print" })}
                          </Button>
                        </Grid>
                      )}
                    </Grid>
                    
                    {/* Cancellation Reason - Show below status if cancelled */}
                    {prescriptionDetail.status === "CANCELLED" && prescriptionDetail.cancelled_reason && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                          {t("prescriptions.cancellationReason", { defaultValue: "Cancellation Reason" })}
                        </Typography>
                        <Alert severity="warning" sx={{ mt: 0.5 }}>
                          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                            {prescriptionDetail.cancelled_reason}
                          </Typography>
                        </Alert>
                      </Box>
                    )}
                    
                    <Divider sx={{ mb: 2 }} />

                    <Grid container spacing={2}>
                      {prescriptionDetail.doctor_name && (
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant="caption" color="text.secondary">
                            {t("prescriptions.doctor", { defaultValue: "Doctor" })}
                          </Typography>
                          <Typography variant="body1">{prescriptionDetail.doctor_name}</Typography>
                        </Grid>
                      )}

                      {prescriptionDetail.visit_type && (
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant="caption" color="text.secondary">
                            {t("prescriptions.visitType", { defaultValue: "Visit Type" })}
                          </Typography>
                          <Typography variant="body1">{prescriptionDetail.visit_type}</Typography>
                        </Grid>
                      )}

                      {prescriptionDetail.chief_complaint && (
                        <Grid size={{ xs: 12 }}>
                          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                            {t("prescriptions.chiefComplaint", { defaultValue: "Chief Complaint / Patient Notes" })}
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                            {prescriptionDetail.chief_complaint}
                          </Typography>
                        </Grid>
                      )}

                      {prescriptionDetail.diagnosis && (
                        <Grid size={{ xs: 12 }}>
                          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                            {t("prescriptions.diagnosis", { defaultValue: "Diagnosis" })}
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                            {prescriptionDetail.diagnosis}
                          </Typography>
                        </Grid>
                      )}

                    </Grid>

                    {/* Medicines - Full Width Section */}
                    {prescriptionDetail.items && prescriptionDetail.items.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                          {t("prescriptions.medicines", { defaultValue: "Medicines" })}
                        </Typography>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          {prescriptionDetail.items.map((item: any, idx: number) => (
                            <Paper key={idx} elevation={1} sx={{ p: 1.5, borderRadius: 2 }}>
                              <Typography variant="body2" fontWeight={500}>
                                {idx + 1}. {item.medicine_name}
                              </Typography>
                              {(item.dosage || item.frequency || item.duration || item.quantity) && (
                                <Typography variant="caption" color="text.secondary">
                                  {[
                                    item.dosage ? `${t("prescriptions.dosage", { defaultValue: "Dosage" })}: ${item.dosage}` : null,
                                    item.frequency ? `${t("prescriptions.frequency", { defaultValue: "Frequency" })}: ${item.frequency}` : null,
                                    item.duration ? `${t("prescriptions.duration", { defaultValue: "Duration" })}: ${item.duration}` : null,
                                    item.quantity ? `${t("prescriptions.quantity", { defaultValue: "Quantity" })}: ${item.quantity}` : null,
                                  ].filter(Boolean).join(" • ")}
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
                      </Box>
                    )}
                  </Paper>
                </Grid>

                {/* Associated Appointment - Full Width */}
                {prescriptionAppointment && (
                  <Grid size={{ xs: 12 }}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        {t("appointments.appointment", { defaultValue: "Appointment" })}
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                          <span><strong>Appointment ID:</strong> {formatAppointmentId(prescriptionAppointment)}</span>
                          <span style={{ margin: "0 8px" }}>•</span>
                          <span><strong>Status:</strong>{" "}
                            <Chip
                              label={getAppointmentStatusLabel(prescriptionAppointment.status)}
                              size="small"
                              color={getAppointmentStatusColor(prescriptionAppointment.status)}
                              sx={{ borderRadius: 2, height: 20, fontSize: "0.7rem" }}
                            />
                          </span>
                          <span style={{ margin: "0 8px" }}>•</span>
                          <Button
                            variant="text"
                            size="small"
                            sx={{ textTransform: "none", minWidth: "auto", p: 0, fontSize: "0.875rem" }}
                            onClick={() => {
                              setSelectedAppointmentId(prescriptionAppointment.id);
                              setAppointmentDetailOpen(true);
                            }}
                          >
                            {t("appointments.viewAppointment", { defaultValue: "View Appointment" })}
                          </Button>
                        </Typography>
                      </Box>
                    </Paper>
                    
                    {/* Audit Information for Appointment */}
                    {(prescriptionAppointment.checked_in_at || prescriptionAppointment.consultation_started_at || prescriptionAppointment.completed_at || prescriptionAppointment.created_at) && (
                      <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          {t("appointments.auditInfo", { defaultValue: "Audit Information & Metadata" })}
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Grid container spacing={2}>
                          {prescriptionAppointment.checked_in_at && (
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Typography variant="caption" color="text.secondary">
                                {t("appointments.checkedInAt", { defaultValue: "Checked In At" })}
                              </Typography>
                              <Typography variant="body2">
                                {new Date(prescriptionAppointment.checked_in_at).toLocaleString()}
                              </Typography>
                            </Grid>
                          )}
                          {prescriptionAppointment.consultation_started_at && (
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Typography variant="caption" color="text.secondary">
                                {t("appointments.consultationStartedAt", { defaultValue: "Consultation Started At" })}
                              </Typography>
                              <Typography variant="body2">
                                {new Date(prescriptionAppointment.consultation_started_at).toLocaleString()}
                              </Typography>
                            </Grid>
                          )}
                          {prescriptionAppointment.completed_at && (
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Typography variant="caption" color="text.secondary">
                                {t("appointments.completedAt", { defaultValue: "Completed At" })}
                              </Typography>
                              <Typography variant="body2">
                                {new Date(prescriptionAppointment.completed_at).toLocaleString()}
                              </Typography>
                            </Grid>
                          )}
                          {prescriptionAppointment.created_at && (
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Typography variant="caption" color="text.secondary">
                                {t("appointments.createdAt", { defaultValue: "Created At" })}
                              </Typography>
                              <Typography variant="body2">
                                {new Date(prescriptionAppointment.created_at).toLocaleString()}
                              </Typography>
                            </Grid>
                          )}
                          {prescriptionDetail.cancelled_at && (
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {t("prescriptions.cancelledAt", { defaultValue: "Cancelled On" })}
                                </Typography>
                                <Typography variant="body2">
                                  {new Date(prescriptionDetail.cancelled_at).toLocaleString()}
                                </Typography>
                              </Grid>
                          )}
                        </Grid>
                      </Paper>
                    )}
                  </Grid>
                )}
              </Grid>
            </>
          ) : (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      <Dialog
        open={printDialogOpen}
        onClose={() => setPrintDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { "@media print": { margin: 0, maxWidth: "100%", height: "100%" } } }}
      >
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="h6">{t("prescriptions.printPreview", { defaultValue: "Print Preview" })}</Typography>
            <IconButton onClick={() => setPrintDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {prescriptionDetail ? (
            <Box id={PRINT_ROOT_ID}>
              <PrescriptionPrintView
                prescription={prescriptionDetail}
                tenantName={user?.tenant_name || tenantInfo?.name || undefined}
                tenantAddress={tenantInfo?.address || undefined}
                tenantPhone={tenantInfo?.contact_phone || undefined}
                tenantEmail={tenantInfo?.contact_email || undefined}
              />
            </Box>
          ) : (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setPrintDialogOpen(false)}>{t("common.close", { defaultValue: "Close" })}</Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={() => window.print()}
            disabled={!prescriptionDetail}
          >
            {t("prescriptions.print", { defaultValue: "Print" })}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Appointment Detail Dialog */}
      <AppointmentDetailDialog
        open={appointmentDetailOpen}
        appointmentId={selectedAppointmentId}
        onClose={() => {
          setAppointmentDetailOpen(false);
          setSelectedAppointmentId(null);
        }}
        onViewPrescription={(prescriptionId) => {
          // When viewing prescription from appointment detail (opened from prescription detail),
          // just close the appointment detail and show the prescription detail that's already open
          setAppointmentDetailOpen(false);
          setSelectedAppointmentId(null);
          // The prescription detail should already be open, so we just need to ensure it's showing the right one
          if (prescriptionId !== selectedPrescription) {
            setSelectedPrescription(prescriptionId);
            setDetailDialogOpen(true);
          }
        }}
      />

      {/* Issue Dialog */}
      <IssuePrescriptionDialog
        open={issueDialogOpen}
        onClose={() => {
          setIssueDialogOpen(false);
          setPrescriptionToIssue(null);
        }}
        onIssue={() => {
          // Child dialog (IssuePrescriptionDialog) already handled API call and showed success toast
          // Parent only needs to close dialog and refresh data
          if (!prescriptionToIssue) return;
          queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
          queryClient.invalidateQueries({ queryKey: ["prescription", selectedPrescription] });
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
          setIssueDialogOpen(false);
          setPrescriptionToIssue(null);
        }}
        prescription={prescriptionToIssue}
      />

      {/* Dispense Dialog */}
      <Dialog
        open={dispenseDialogOpen}
        onClose={() => {
          setDispenseDialogOpen(false);
          setPrescriptionToDispense(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t("prescriptions.dispensePrescription", { defaultValue: "Dispense Prescription" })}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {t("prescriptions.confirmDispense", { defaultValue: "Dispense this prescription? This will deduct stock quantities." })}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDispenseDialogOpen(false);
              setPrescriptionToDispense(null);
            }}
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => {
              if (!prescriptionToDispense) return;
              dispenseMutation.mutate({ id: prescriptionToDispense.id, prescription: prescriptionToDispense });
              setDispenseDialogOpen(false);
              setPrescriptionToDispense(null);
            }}
            disabled={dispenseMutation.isPending}
          >
            {t("prescriptions.dispense", { defaultValue: "Dispense" })}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog
        open={cancelDialogOpen}
        onClose={() => {
          setCancelDialogOpen(false);
          setPrescriptionToCancel(null);
          setCancelReason("");
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t("prescriptions.cancelPrescription", { defaultValue: "Cancel Prescription" })}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {t("prescriptions.confirmCancel", {
                defaultValue: "Are you sure you want to cancel this prescription? This action cannot be undone.",
              })}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              label={t("prescriptions.cancelReason", { defaultValue: "Reason for cancellation" })}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              required
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCancelDialogOpen(false);
              setPrescriptionToCancel(null);
              setCancelReason("");
            }}
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>

          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (!cancelReason.trim()) {
                showError(t("prescriptions.cancelReasonRequired", { defaultValue: "Please provide a reason for cancellation" }));
                return;
              }
              if (!prescriptionToCancel) return;

              if (prescriptionToCancel.status !== "DRAFT") {
                showError(t("prescriptions.canOnlyCancelDraft", { defaultValue: "Only draft prescriptions can be cancelled" }));
                return;
              }

              statusMutation.mutate({
                id: prescriptionToCancel.id,
                status: "CANCELLED",
                options: { reason: cancelReason },
                prescription: prescriptionToCancel,
              });

              setCancelDialogOpen(false);
              setPrescriptionToCancel(null);
              setCancelReason("");
            }}
          >
            {t("prescriptions.confirmCancel", { defaultValue: "Confirm Cancel" })}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PrescriptionsPage;