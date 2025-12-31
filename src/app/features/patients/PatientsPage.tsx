// src/app/features/patients/PatientsPage.tsx
import React from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  CircularProgress,
  TablePagination,
  TextField,
  TableSortLabel,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import PageToolbar from "@app/components/common/PageToolbar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@app/lib/apiClient";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useToast } from "@app/components/common/ToastProvider";
import { useAuthStore } from "@app/store/authStore";
import { can } from "@app/lib/abac";
import { 
  Add as AddIcon, 
  Inbox as EmptyIcon, 
  People as PeopleIcon,
  FileDownload as FileDownloadIcon,
  PictureAsPdf as PdfIcon,
} from "@mui/icons-material";
import QuickRegisterDialog from "./QuickRegisterDialog";
import PatientRow from "./PatientRow";
import AppointmentFormDialog from "@app/features/appointments/AppointmentFormDialog";
import AdmissionFormDialog from "@app/features/admissions/AdmissionFormDialog";
import PrescriptionFormDialog from "@app/features/prescriptions/PrescriptionFormDialog";

interface Patient {
  id: string;
  patient_code?: string | null;
  first_name: string;
  last_name?: string | null;
  middle_name?: string | null;
  phone_primary?: string | null;
  phone?: string | null;
  email?: string | null;
  department?: string | null;
  department_id?: string | null;
  patient_type: "OPD" | "IPD";
  dob?: string | null;
  city?: string | null;
  is_deceased?: boolean;
  date_of_death?: string | null;
  created_at: string;
  last_visited_at?: string | null;
  // Visit flags (optional, included when include=visit_flags)
  has_active_admission?: boolean | null;
  next_eligible_opd_appointment_at?: string | null;
}

const fetchPatients = async (
  search?: string,
  departmentId?: string,
  doctorUserId?: string,
  patientType?: string,
  visitType?: string,
  dateFrom?: string,
  dateTo?: string,
  registeredFrom?: string,
  registeredTo?: string,
  gender?: string,
  page: number = 1,
  pageSize: number = 20,
  include?: string
): Promise<{ items: Patient[]; total: number; page: number; page_size: number }> => {
  const params: any = { page, page_size: pageSize };
  if (search) params.search = search;
  if (departmentId) params.department_id = departmentId;
  if (doctorUserId) params.doctor_user_id = doctorUserId;
  if (patientType) params.patient_type = patientType;
  if (visitType) params.visit_type = visitType;
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;
  if (registeredFrom) params.registered_from = registeredFrom;
  if (registeredTo) params.registered_to = registeredTo;
  if (gender) params.gender = gender;
  if (include) params.include = include;
  const res = await apiClient.get<{ items: Patient[]; total: number; page: number; page_size: number }>("/patients", { params });
  return res.data;
};

const calculateAge = (dob: string | null): number | null => {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
};

const formatDisplayName = (patient: Patient): string => {
  const parts = [patient.first_name];
  if (patient.middle_name) parts.push(patient.middle_name);
  if (patient.last_name) parts.push(patient.last_name);
  return parts.join(" ");
};

type Order = "asc" | "desc";
type OrderBy = "name" | "created_at";


const PatientsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const user = useAuthStore((s) => s.user);
  const [searchParams] = useSearchParams();

  // Read initial values from URL params (for navigation from dashboard)
  const initialCareType = searchParams.get("care_type") || "all";
  const initialRegisteredFrom = searchParams.get("registered_from") || "";
  const initialRegisteredTo = searchParams.get("registered_to") || "";
  const initialGender = searchParams.get("gender") || "all";

  // Local state for filters, search, pagination, and sorting
  const [search, setSearch] = React.useState("");
  const [careTypeFilter, setCareTypeFilter] = React.useState<string>(initialCareType);
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("all");
  const [doctorFilter, setDoctorFilter] = React.useState<string>("all");
  const [dateFromFilter, setDateFromFilter] = React.useState<string>("");
  const [dateToFilter, setDateToFilter] = React.useState<string>("");
  const [registeredFromFilter, setRegisteredFromFilter] = React.useState<string>(initialRegisteredFrom);
  const [registeredToFilter, setRegisteredToFilter] = React.useState<string>(initialRegisteredTo);
  const [genderFilter, setGenderFilter] = React.useState<string>(initialGender);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [order, setOrder] = React.useState<Order>("desc");
  const [orderBy, setOrderBy] = React.useState<OrderBy>("created_at");
  
  const [openDialog, setOpenDialog] = React.useState(false);
  const [appointmentDialogOpen, setAppointmentDialogOpen] = React.useState(false);
  const [admissionDialogOpen, setAdmissionDialogOpen] = React.useState(false);
  const [prescriptionDialogOpen, setPrescriptionDialogOpen] = React.useState(false);
  const [selectedPatientId, setSelectedPatientId] = React.useState<string | null>(null);

  // Fetch tenant info to check limits
  const { data: tenantInfo } = useQuery({
    queryKey: ["tenant-info"],
    queryFn: async () => {
      const res = await apiClient.get("/auth/me");
      return res.data;
    },
  });

  // Check permissions
  const canViewDepartments = user ? can(user, "departments:view") : false;
  const canViewUsers = user ? can(user, "users:view") : false;

  // Fetch departments and doctors for filters - only if user has permission
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await apiClient.get("/departments")).data,
    enabled: canViewDepartments,
  });

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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["patients", search, careTypeFilter, departmentFilter, doctorFilter, dateFromFilter, dateToFilter, registeredFromFilter, registeredToFilter, genderFilter, page + 1, rowsPerPage],
    queryFn: () => {
      // Map care_type to backend parameters
      let patientType: string | undefined;
      let visitType: string | undefined;
      
      if (careTypeFilter === "IPD") {
        patientType = "IPD"; // Backend uses patient_type for active IPD
      } else if (careTypeFilter === "OPD") {
        visitType = "OPD_ELIGIBLE"; // Special value for eligible OPD (backend will handle)
      }
      
      return fetchPatients(
        search || undefined,
        departmentFilter !== "all" ? departmentFilter : undefined,
        doctorFilter !== "all" ? doctorFilter : undefined,
        patientType,
        visitType,
        dateFromFilter || undefined,
        dateToFilter || undefined,
        registeredFromFilter || undefined,
        registeredToFilter || undefined,
        genderFilter !== "all" ? genderFilter : undefined,
        page + 1,
        rowsPerPage,
        "visit_flags" // Include visit flags for batch computation
      );
    },
    // Ensure query refetches when page changes
    refetchOnMount: true,
  });

  const patients = data?.items ?? [];
  const totalPatients = data?.total ?? 0;

  const handleSearchChange = React.useCallback((value: string) => {
    setSearch(value);
    setPage(0);
  }, []);

  const handleChangePage = (
    _event: unknown,
    newPage: number
  ) => {
    setPage(newPage);
  };

  const handleExportCSV = async () => {
    try {
      const params: any = {};
      if (search) params.search = search;
      if (departmentFilter !== "all") params.department_id = departmentFilter;
      if (doctorFilter !== "all") params.doctor_user_id = doctorFilter;
      if (dateFromFilter) params.date_from = dateFromFilter;
      if (dateToFilter) params.date_to = dateToFilter;
      
      const res = await apiClient.get("/patients/export/csv", { params, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `patients_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const handleExportPDF = async () => {
    try {
      const params: any = {};
      if (search) params.search = search;
      // visit_type is handled in queryFn above
      if (departmentFilter !== "all") params.department_id = departmentFilter;
      if (doctorFilter !== "all") params.doctor_user_id = doctorFilter;
      if (dateFromFilter) params.date_from = dateFromFilter;
      if (dateToFilter) params.date_to = dateToFilter;
      
      const res = await apiClient.get("/patients/export/pdf", { params, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `patients_${new Date().toISOString().split("T")[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const handleRequestSort = (property: OrderBy) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  // Client-side sorting (backend handles search/filtering)
  const sorted = [...patients].sort((a, b) => {
    if (orderBy === "name") {
      const nameA = formatDisplayName(a).toLowerCase();
      const nameB = formatDisplayName(b).toLowerCase();
      if (nameA < nameB) return order === "asc" ? -1 : 1;
      if (nameA > nameB) return order === "asc" ? 1 : -1;
      return 0;
    } else {
      const dateA = new Date(a.last_visited_at || a.created_at).getTime();
      const dateB = new Date(b.last_visited_at || b.created_at).getTime();
      return order === "asc" ? dateA - dateB : dateB - dateA;
    }
  });

  return (
    <Box>
      <PageToolbar
        title={t("patients.title", { defaultValue: "Patients" })}
        subtitle={t("patients.subtitle", {
          defaultValue: "Manage patient records, medical history, and appointments.",
        })}
        titleIcon={<PeopleIcon sx={{ fontSize: 32 }} />}
        searchPlaceholder={t("patients.searchPlaceholder", {
          defaultValue: "Search by name, phone, email...",
        })}
        searchValue={search}
        onSearchChange={handleSearchChange}
        primaryAction={{
          label: t("patients.quickRegister", { defaultValue: "Quick Register" }),
          onClick: async () => {
            // Pre-check: Verify patient limit before opening form
            if (tenantInfo?.tenant?.max_patients !== null && tenantInfo?.tenant?.max_patients !== undefined) {
              // Get current patient count from the data we already have
              const currentPatientCount = data?.total || 0;
              if (currentPatientCount >= tenantInfo.tenant.max_patients) {
                showError(
                  t("patients.maxPatientsReached", {
                    defaultValue: `Cannot create patient. Maximum patient limit (${tenantInfo.tenant.max_patients}) has been reached. Please contact Platform Administrator to increase the limit.`,
                    limit: tenantInfo.tenant.max_patients,
                  })
                );
                return;
              }
            }
            
            // Check if tenant is suspended
            if (tenantInfo?.tenant?.status === "SUSPENDED") {
              showError(
                t("patients.tenantSuspended", {
                  defaultValue: "Cannot create patients. Hospital account is suspended. Please contact support.",
                })
              );
              return;
            }
            
            setOpenDialog(true);
          },
          icon: <AddIcon />,
        }}
      />
      {/* Filters */}
      <Paper elevation={1} sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>{t("patients.visitType", { defaultValue: "Visit Type" })}</InputLabel>
              <Select
                value={careTypeFilter}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setCareTypeFilter(newValue);
                  setPage(0);
                }}
                label={t("patients.visitType", { defaultValue: "Visit Type" })}
              >
                <MenuItem value="all">{t("common.all", { defaultValue: "All" })}</MenuItem>
                <MenuItem value="OPD">OPD</MenuItem>
                <MenuItem value="IPD">IPD</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>{t("patients.department", { defaultValue: "Department" })}</InputLabel>
              <Select
                value={departmentFilter}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setDepartmentFilter(newValue);
                  setPage(0);
                }}
                label={t("patients.department", { defaultValue: "Department" })}
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
              <InputLabel>{t("patients.doctor", { defaultValue: "Doctor" })}</InputLabel>
              <Select
                value={doctorFilter}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setDoctorFilter(newValue);
                  setPage(0);
                }}
                label={t("patients.doctor", { defaultValue: "Doctor" })}
              >
                <MenuItem value="all">{t("common.all", { defaultValue: "All" })}</MenuItem>
                {doctors?.map((doc: any) => (
                  <MenuItem key={doc.id} value={doc.id}>
                    {doc.first_name} {doc.last_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              type="date"
              label={t("patients.lastVisitDateFrom", { defaultValue: "Last Visit Date From" })}
              fullWidth
              size="small"
              value={dateFromFilter}
              onChange={(e) => {
                const newDateFrom = e.target.value;
                setDateFromFilter(newDateFrom);
                // Validate: if date_to is set and less than date_from, clear it
                if (dateToFilter && newDateFrom && dateToFilter < newDateFrom) {
                  setDateToFilter("");
                }
                setPage(0);
              }}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              type="date"
              label={t("patients.lastVisitDateTo", { defaultValue: "Last Visit Date To" })}
              fullWidth
              size="small"
              value={dateToFilter}
              onChange={(e) => {
                const newDateTo = e.target.value;
                // Validate: date_to should not be less than date_from
                if (dateFromFilter && newDateTo && newDateTo < dateFromFilter) {
                  showError(t("patients.dateToBeforeDateFrom", { defaultValue: "Date To cannot be before Date From" }));
                  return;
                }
                setDateToFilter(newDateTo);
                setPage(0);
              }}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: dateFromFilter || undefined }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <Box display="flex" gap={1}>
              <IconButton
                onClick={handleExportCSV}
                title={t("patients.exportCSV", { defaultValue: "Export CSV" })}
                color="primary"
                size="large">
                <FileDownloadIcon />
              </IconButton>
              <IconButton
                onClick={handleExportPDF}
                title={t("patients.exportPDF", { defaultValue: "Export PDF" })}
                color="error"
                size="large">
                <PdfIcon />
              </IconButton>
            </Box>
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
          <Box
            sx={{
              py: 6,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sortDirection={orderBy === "name" ? order : false}>
                      <TableSortLabel
                        active={orderBy === "name"}
                        direction={orderBy === "name" ? order : "asc"}
                        onClick={() => handleRequestSort("name")}
                      >
                        {t("patients.name", { defaultValue: "Name" })}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>{t("patients.patientCode", { defaultValue: "Patient Code" })}</TableCell>
                    <TableCell>{t("patients.age", { defaultValue: "Age" })}</TableCell>
                    <TableCell>{t("patients.phone", { defaultValue: "Phone" })}</TableCell>
                    <TableCell>{t("patients.city", { defaultValue: "City" })}</TableCell>
                    <TableCell
                      sortDirection={
                        orderBy === "created_at" ? order : false
                      }
                    >
                      <TableSortLabel
                        active={orderBy === "created_at"}
                        direction={orderBy === "created_at" ? order : "desc"}
                        onClick={() => handleRequestSort("created_at")}
                      >
                        {t("patients.lastVisit", { defaultValue: "Last Visit" })}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="center" width={200}>
                      {t("patients.actions", { defaultValue: "Actions" })}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sorted.map((p) => {
                    const age = calculateAge(p.dob ?? null);
                    const displayName = formatDisplayName(p);
                    return (
                      <PatientRow
                        key={p.id}
                        patient={p}
                        age={age}
                        displayName={displayName}
                        onView={() => navigate(`/patients/${p.id}`)}
                        onCreateOPD={() => {
                          setSelectedPatientId(p.id);
                          setAppointmentDialogOpen(true);
                        }}
                        onAdmit={() => {
                          setSelectedPatientId(p.id);
                          setAdmissionDialogOpen(true);
                        }}
                        onWritePrescription={() => {
                          setSelectedPatientId(p.id);
                          setPrescriptionDialogOpen(true);
                        }}
                        t={t}
                        showError={showError}
                      />
                    );
                  })}
                  {sorted.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                        <EmptyIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2, opacity: 0.5 }} />
                        <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                          {t("patients.empty", { defaultValue: "No patients found" })}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t("patients.emptyDescription", {
                            defaultValue: search
                              ? "Try adjusting your search criteria."
                              : "Get started by registering your first patient.",
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
              count={totalPatients}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                const newRowsPerPage = parseInt(e.target.value, 10);
                setRowsPerPage(newRowsPerPage);
                setPage(0);
              }}
              rowsPerPageOptions={[10, 20, 50, 100]}
              labelRowsPerPage={t("patients.rowsPerPage", { defaultValue: "Rows per page:" })}
            />
          </>
        )}
      </Paper>
      <QuickRegisterDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onCreated={() => refetch()}
      />
      <AppointmentFormDialog
        open={appointmentDialogOpen}
        onClose={() => {
          setAppointmentDialogOpen(false);
          setSelectedPatientId(null);
        }}
        onCreated={() => {
          // Child dialog (AppointmentFormDialog) already showed success toast
          // Parent only needs to close dialog and refresh data
          setAppointmentDialogOpen(false);
          setSelectedPatientId(null);
          queryClient.invalidateQueries({ queryKey: ["patients"] });
        }}
        initialPatientId={selectedPatientId || undefined}
      />
      <AdmissionFormDialog
        open={admissionDialogOpen}
        onClose={() => {
          setAdmissionDialogOpen(false);
          setSelectedPatientId(null);
        }}
        onCreated={() => {
          // Child dialog (AdmissionFormDialog) already showed success toast
          // Parent only needs to close dialog and refresh data
          setAdmissionDialogOpen(false);
          setSelectedPatientId(null);
          queryClient.invalidateQueries({ queryKey: ["patients"] });
        }}
        initialPatientId={selectedPatientId || undefined}
      />
      <PrescriptionFormDialog
        open={prescriptionDialogOpen}
        onClose={() => {
          setPrescriptionDialogOpen(false);
          setSelectedPatientId(null);
        }}
        onCreated={() => {
          // Child dialog (PrescriptionFormDialog) already showed success toast
          // Parent only needs to close dialog and refresh data
          setPrescriptionDialogOpen(false);
          setSelectedPatientId(null);
          queryClient.invalidateQueries({ queryKey: ["patients"] });
        }}
        initialPatientId={selectedPatientId || undefined}
      />
    </Box>
  );
};

export default PatientsPage;