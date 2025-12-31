// src/app/features/platform/TenantsManagementPage.tsx
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
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  TablePagination,
  InputAdornment,
  Divider,
  Stack,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@app/lib/apiClient";
import { useTranslation } from "react-i18next";
import { useToast } from "@app/components/common/ToastProvider";
import PageToolbar from "@app/components/common/PageToolbar";
import {
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Settings as SettingsIcon,
  LockReset as LockResetIcon,
  Visibility as VisibilityIcon,
  Search as SearchIcon,
} from "@mui/icons-material";

interface Tenant {
  id: string;
  name: string;
  license_number: string;
  contact_email: string;
  status: string;
  user_count: number;
  patient_count: number;
  max_users: number | null;
  max_patients?: number | null;
  created_at: string;
  metrics?: {
    total_patients?: number;
  };
}

const statusColor: Record<string, "default" | "success" | "warning" | "error"> = {
  PENDING: "warning",
  VERIFIED: "default",
  ACTIVE: "success",
  SUSPENDED: "error",
  INACTIVE: "default",
};

const TenantsManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [suspendDialogOpen, setSuspendDialogOpen] = React.useState(false);
  const [activateDialogOpen, setActivateDialogOpen] = React.useState(false);
  const [limitsDialogOpen, setLimitsDialogOpen] = React.useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = React.useState(false);
  const [selectedTenant, setSelectedTenant] = React.useState<Tenant | null>(null);
  const [maxUsers, setMaxUsers] = React.useState<string>("");
  const [maxPatients, setMaxPatients] = React.useState<string>("");
  const [searchInput, setSearchInput] = React.useState<string>("");
  const [searchTerm, setSearchTerm] = React.useState<string>("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Debounced search effect - only search after 2+ characters with 600ms delay
  React.useEffect(() => {
    const trimmedInput = searchInput.trim();
    
    // Only search if input has 2+ characters
    if (trimmedInput.length >= 2) {
      const timer = setTimeout(() => {
        setSearchTerm(trimmedInput);
        setPage(0); // Reset to first page on new search
        // Return focus to search box after search
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      }, 600);
      
      return () => clearTimeout(timer);
    } else if (trimmedInput.length === 0) {
      // Clear search immediately if input is empty
      setSearchTerm("");
      setPage(0);
    }
  }, [searchInput]);

  const { data: tenantsData, isLoading } = useQuery<{ items: Tenant[]; total: number; page: number; page_size: number }>({
    queryKey: ["platform-tenants", page + 1, rowsPerPage, searchTerm, statusFilter],
    queryFn: async () => {
      const params: any = {
        page: page + 1,
        page_size: rowsPerPage,
      };
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }
      if (statusFilter) {
        params.status_filter = statusFilter;
      }
      const res = await apiClient.get("/platform/tenants", { params });
      return res.data;
    },
  });

  const tenants = tenantsData?.items || [];
  const totalTenants = tenantsData?.total || 0;

  const suspendMutation = useMutation({
    mutationFn: (tenantId: string) =>
      apiClient.patch(`/platform/tenants/${tenantId}/suspend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
      showSuccess(t("platform.tenantSuspended", { defaultValue: "Tenant suspended successfully" }));
      setSuspendDialogOpen(false);
      setSelectedTenant(null);
    },
    onError: (error: any) => {
      showError(
        error?.response?.data?.detail ||
          t("platform.suspendError", { defaultValue: "Failed to suspend tenant" })
      );
    },
  });

  const activateMutation = useMutation({
    mutationFn: (tenantId: string) =>
      apiClient.patch(`/platform/tenants/${tenantId}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
      showSuccess(t("platform.tenantActivated", { defaultValue: "Tenant activated successfully" }));
      setActivateDialogOpen(false);
      setSelectedTenant(null);
    },
    onError: (error: any) => {
      showError(
        error?.response?.data?.detail ||
          t("platform.activateError", { defaultValue: "Failed to activate tenant" })
      );
    },
  });

  const setLimitsMutation = useMutation({
    mutationFn: ({ tenantId, maxUsers, maxPatients }: { tenantId: string; maxUsers?: number | null; maxPatients?: number | null }) => {
      const params: any = {};
      if (maxUsers !== undefined && maxUsers !== null) params.max_users = maxUsers;
      if (maxPatients !== undefined && maxPatients !== null) params.max_patients = maxPatients;
      return apiClient.patch(`/platform/tenants/${tenantId}/limits`, null, { params });
    },
    onSuccess: async (_, variables) => {
      // Invalidate and refetch tenant data
      await queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
      await queryClient.invalidateQueries({ queryKey: ["platform-tenant-details", variables.tenantId] });
      // Refetch to get latest data
      await queryClient.refetchQueries({ queryKey: ["platform-tenants"] });
      showSuccess(t("platform.limitsSet", { defaultValue: "Limits set successfully" }));
      setLimitsDialogOpen(false);
      setSelectedTenant(null);
      setMaxUsers("");
      setMaxPatients("");
    },
    onError: (error: any) => {
      showError(
        error?.response?.data?.detail ||
          t("platform.setLimitsError", { defaultValue: "Failed to set limits" })
      );
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (tenantId: string) =>
      apiClient.post(`/platform/tenants/${tenantId}/reset-admin-password`),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
      showSuccess(
        t("platform.passwordReset", {
          defaultValue: `Password reset successfully. Temporary password: ${data.data.temp_password}`,
          tempPassword: data.data.temp_password,
        })
      );
      setResetPasswordDialogOpen(false);
      setSelectedTenant(null);
    },
    onError: (error: any) => {
      showError(
        error?.response?.data?.detail ||
          t("platform.resetPasswordError", { defaultValue: "Failed to reset password" })
      );
    },
  });

  const handleSuspend = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setSuspendDialogOpen(true);
  };

  const handleActivate = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setActivateDialogOpen(true);
  };

  const handleSetLimits = (tenant: Tenant) => {
    // Use the tenant from the current query data to ensure we have the latest values
    const currentTenant = tenants.find(t => t.id === tenant.id) || tenant;
    setSelectedTenant(currentTenant);
    // Set the current max_users value, or empty string if null/undefined
    const currentMaxUsers = currentTenant.max_users !== null && currentTenant.max_users !== undefined 
      ? currentTenant.max_users.toString() 
      : "";
    const currentMaxPatients = currentTenant.max_patients !== null && currentTenant.max_patients !== undefined 
      ? currentTenant.max_patients.toString() 
      : "";
    setMaxUsers(currentMaxUsers);
    setMaxPatients(currentMaxPatients);
    setLimitsDialogOpen(true);
  };

  // Sync form values when tenant data updates (after mutation) or when dialog opens
  React.useEffect(() => {
    if (limitsDialogOpen && selectedTenant) {
      const currentTenant = tenants.find(t => t.id === selectedTenant.id);
      if (currentTenant) {
        // Update selectedTenant to latest data (including patient_count)
        setSelectedTenant(currentTenant);
        const currentMaxUsers = currentTenant.max_users !== null && currentTenant.max_users !== undefined 
          ? currentTenant.max_users.toString() 
          : "";
        const currentMaxPatients = currentTenant.max_patients !== null && currentTenant.max_patients !== undefined 
          ? currentTenant.max_patients.toString() 
          : "";
        setMaxUsers(currentMaxUsers);
        setMaxPatients(currentMaxPatients);
      }
    }
  }, [tenants, limitsDialogOpen, selectedTenant?.id]);

  const handleResetPassword = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setResetPasswordDialogOpen(true);
  };

  const handleViewDetails = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setDetailDialogOpen(true);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box>
      <PageToolbar
        title={t("platform.tenantManagement", { defaultValue: "Tenant Management" })}
      />

      <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
        {/* Search and Filter Controls */}
        <Box sx={{ mb: 3, display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            inputRef={searchInputRef}
            placeholder={t("platform.searchTenants", { 
              defaultValue: "Search by name, license number, or email..." 
            })}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            size="medium"
            sx={{ flexGrow: 1, minWidth: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select
            label={t("platform.statusFilter", { defaultValue: "Status" })}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            size="medium"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">
              {t("common.all", { defaultValue: "All" })}
            </MenuItem>
            <MenuItem value="PENDING">
              {t("platform.statusPending", { defaultValue: "Pending" })}
            </MenuItem>
            <MenuItem value="VERIFIED">
              {t("platform.statusVerified", { defaultValue: "Verified" })}
            </MenuItem>
            <MenuItem value="ACTIVE">
              {t("platform.statusActive", { defaultValue: "Active" })}
            </MenuItem>
            <MenuItem value="SUSPENDED">
              {t("platform.statusSuspended", { defaultValue: "Suspended" })}
            </MenuItem>
            <MenuItem value="INACTIVE">
              {t("platform.statusInactive", { defaultValue: "Inactive" })}
            </MenuItem>
          </TextField>
        </Box>

        {isLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : tenants && tenants.length > 0 ? (
          <>
            <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("platform.tenantName", { defaultValue: "Tenant Name" })}</TableCell>
                  <TableCell>{t("platform.licenseNumber", { defaultValue: "License" })}</TableCell>
                  <TableCell>{t("platform.contactEmail", { defaultValue: "Contact Email" })}</TableCell>
                  <TableCell>{t("platform.status", { defaultValue: "Status" })}</TableCell>
                  <TableCell>{t("platform.userCount", { defaultValue: "Users" })}</TableCell>
                  <TableCell>{t("platform.maxUsers", { defaultValue: "Max Users" })}</TableCell>
                  <TableCell>{t("platform.createdAt", { defaultValue: "Created At" })}</TableCell>
                  <TableCell align="right">{t("common.actions", { defaultValue: "Actions" })}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id} hover>
                    <TableCell>{tenant.name}</TableCell>
                    <TableCell>{tenant.license_number}</TableCell>
                    <TableCell>{tenant.contact_email}</TableCell>
                    <TableCell>
                      <Chip
                        label={tenant.status}
                        size="small"
                        color={statusColor[tenant.status] ?? "default"}
                      />
                    </TableCell>
                    <TableCell>{tenant.user_count}</TableCell>
                    <TableCell>{tenant.max_users ?? "∞"}</TableCell>
                    <TableCell>
                      {new Date(tenant.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleViewDetails(tenant)}
                          title={t("common.viewDetails", { defaultValue: "View Details" })}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                        {tenant.status === "ACTIVE" ? (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleSuspend(tenant)}
                            title={t("platform.suspend", { defaultValue: "Suspend" })}
                          >
                            <BlockIcon fontSize="small" />
                          </IconButton>
                        ) : (
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => handleActivate(tenant)}
                            title={t("platform.activate", { defaultValue: "Activate" })}
                          >
                            <CheckCircleIcon fontSize="small" />
                          </IconButton>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => handleSetLimits(tenant)}
                          title={t("platform.setLimit", { defaultValue: "Set Limit" })}
                        >
                          <SettingsIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleResetPassword(tenant)}
                          title={t("platform.resetAdminPassword", { defaultValue: "Reset Admin Password" })}
                        >
                          <LockResetIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={totalTenants}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 20, 50, 100]}
            labelRowsPerPage={t("common.rowsPerPage", { defaultValue: "Rows per page:" })}
          />
          </>
        ) : (
          <Box textAlign="center" py={4}>
            <Typography variant="body1" color="text.secondary">
              {searchTerm || statusFilter
                ? t("platform.noTenantsFound", { defaultValue: "No tenants found matching your criteria" })
                : t("platform.noTenants", { defaultValue: "No tenants found" })}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Suspend Dialog */}
      <Dialog open={suspendDialogOpen} onClose={() => setSuspendDialogOpen(false)}>
        <DialogTitle>
          {t("platform.confirmSuspend", { defaultValue: "Suspend Tenant" })}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {t("platform.suspendConfirmMessage", {
              defaultValue: `Are you sure you want to suspend "${selectedTenant?.name}"? This will prevent all users from accessing the system.`,
              tenantName: selectedTenant?.name,
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuspendDialogOpen(false)}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => selectedTenant && suspendMutation.mutate(selectedTenant.id)}
            disabled={suspendMutation.isPending}
          >
            {t("platform.suspend", { defaultValue: "Suspend" })}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Activate Dialog */}
      <Dialog open={activateDialogOpen} onClose={() => setActivateDialogOpen(false)}>
        <DialogTitle>
          {t("platform.confirmActivate", { defaultValue: "Activate Tenant" })}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {t("platform.activateConfirmMessage", {
              defaultValue: `Are you sure you want to activate "${selectedTenant?.name}"?`,
              tenantName: selectedTenant?.name,
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActivateDialogOpen(false)}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => selectedTenant && activateMutation.mutate(selectedTenant.id)}
            disabled={activateMutation.isPending}
          >
            {t("platform.activate", { defaultValue: "Activate" })}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Set Limits Dialog */}
      <Dialog open={limitsDialogOpen} onClose={() => setLimitsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {t("platform.setLimits", { defaultValue: "Set Limits" })}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <Stack spacing={3}>
              {selectedTenant && (
                <SetLimitsContent 
                  tenantId={selectedTenant.id}
                  maxUsers={maxUsers}
                  setMaxUsers={setMaxUsers}
                  maxPatients={maxPatients}
                  setMaxPatients={setMaxPatients}
                />
              )}
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLimitsDialogOpen(false)}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (selectedTenant) {
                const maxUsersVal = maxUsers ? parseInt(maxUsers, 10) : null;
                const maxPatientsVal = maxPatients ? parseInt(maxPatients, 10) : null;
                setLimitsMutation.mutate({
                  tenantId: selectedTenant.id,
                  maxUsers: maxUsersVal,
                  maxPatients: maxPatientsVal,
                });
              }
            }}
            disabled={setLimitsMutation.isPending}
          >
            {t("common.save", { defaultValue: "Save" })}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialogOpen} onClose={() => setResetPasswordDialogOpen(false)}>
        <DialogTitle>
          {t("platform.resetAdminPassword", { defaultValue: "Reset Admin Password" })}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {t("platform.resetPasswordConfirmMessage", {
              defaultValue: `Reset admin password for "${selectedTenant?.name}"? A temporary password will be sent to the admin email.`,
              tenantName: selectedTenant?.name,
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetPasswordDialogOpen(false)}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            variant="contained"
            onClick={() => selectedTenant && resetPasswordMutation.mutate(selectedTenant.id)}
            disabled={resetPasswordMutation.isPending}
          >
            {t("platform.resetPassword", { defaultValue: "Reset Password" })}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tenant Detail Dialog */}
      <Dialog 
        open={detailDialogOpen} 
        onClose={() => {
          setDetailDialogOpen(false);
          setSelectedTenant(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {t("platform.tenantDetails", { defaultValue: "Tenant Details" })}
        </DialogTitle>
        <DialogContent>
          {selectedTenant && (
            <TenantDetailContent 
              tenant={tenants.find(t => t.id === selectedTenant.id) || selectedTenant} 
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDetailDialogOpen(false);
            setSelectedTenant(null);
          }}>
            {t("common.close", { defaultValue: "Close" })}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Set Limits Content Component - Uses details API for accurate tenant-specific counts
const SetLimitsContent: React.FC<{
  tenantId: string;
  maxUsers: string;
  setMaxUsers: (value: string) => void;
  maxPatients: string;
  setMaxPatients: (value: string) => void;
}> = ({ tenantId, maxUsers, setMaxUsers, maxPatients, setMaxPatients }) => {
  const { t } = useTranslation();
  const { data: details, isLoading } = useQuery({
    queryKey: ["platform-tenant-details", tenantId],
    queryFn: async () => {
      const res = await apiClient.get(`/platform/tenants/${tenantId}/details`);
      return res.data;
    },
    enabled: !!tenantId,
  });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={2}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  // Use metrics from details API for tenant-specific counts
  const metrics = details?.metrics || {};
  const currentUserCount = metrics.user_count ?? 0;
  const currentPatientCount = metrics.total_patients ?? 0;

  return (
    <>
      <TextField
        label={t("platform.maxUsers", { defaultValue: "Max Users" })}
        type="number"
        fullWidth
        value={maxUsers}
        onChange={(e) => setMaxUsers(e.target.value)}
        inputProps={{ min: 1 }}
        helperText={t("platform.maxUsersHelper", {
          defaultValue: "Enter a number to set max users, or leave empty for unlimited. Current users: {{count}}",
          count: currentUserCount,
        })}
      />
      <TextField
        label={t("platform.maxPatients", { defaultValue: "Max Patients" })}
        type="number"
        fullWidth
        value={maxPatients}
        onChange={(e) => setMaxPatients(e.target.value)}
        inputProps={{ min: 1 }}
        helperText={t("platform.maxPatientsHelper", {
          defaultValue: "Enter a number to set max patients, or leave empty for unlimited. Current patients: {{count}}",
          count: currentPatientCount,
        })}
      />
    </>
  );
};

// Tenant Detail Component
const TenantDetailContent: React.FC<{ tenant: Tenant }> = ({ tenant }) => {
  const { t } = useTranslation();
  const { data: details, isLoading } = useQuery({
    queryKey: ["platform-tenant-details", tenant.id],
    queryFn: async () => {
      const res = await apiClient.get(`/platform/tenants/${tenant.id}/details`);
      return res.data;
    },
    enabled: !!tenant.id,
  });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  // Use tenant from details response (has latest data including max_users, max_patients) or fallback to prop
  const tenantData = details?.tenant || tenant;
  // Use metrics from details API (has user_count, total_patients, etc.) or fallback to tenant data
  const metrics = details?.metrics || {
    user_count: tenant.user_count || 0,
    total_patients: tenant.patient_count || 0,
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid size={{ xs: 12 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {t("platform.basicInformation", { defaultValue: "Basic Information" })}
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                {t("platform.tenantName", { defaultValue: "Tenant Name" })}
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {tenantData.name}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                {t("platform.licenseNumber", { defaultValue: "License Number" })}
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {tenantData.license_number}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                {t("platform.contactEmail", { defaultValue: "Contact Email" })}
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {tenantData.contact_email}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                {t("platform.contactPhone", { defaultValue: "Contact Phone" })}
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {tenantData.contact_phone || "-"}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                {t("platform.status", { defaultValue: "Status" })}
              </Typography>
              <Chip
                label={tenantData.status}
                size="small"
                color={statusColor[tenantData.status] ?? "default"}
                sx={{ mt: 0.5 }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                {t("platform.createdAt", { defaultValue: "Created At" })}
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {new Date(tenantData.created_at).toLocaleString()}
              </Typography>
            </Grid>
          </Grid>
        </Grid>

        {/* Metrics */}
        <Grid size={{ xs: 12 }}>
          <Typography variant="h6" sx={{ mb: 2, mt: 2 }}>
            {t("platform.metrics", { defaultValue: "Metrics" })}
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper elevation={1} sx={{ p: 2, textAlign: "center" }}>
                <Typography variant="h4" fontWeight={700} color="primary">
                  {metrics.user_count || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("platform.totalUsers", { defaultValue: "Total Users" })}
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper elevation={1} sx={{ p: 2, textAlign: "center" }}>
                <Typography variant="h4" fontWeight={700} color="primary">
                  {metrics.total_patients || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("platform.totalPatients", { defaultValue: "Total Patients" })}
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper elevation={1} sx={{ p: 2, textAlign: "center" }}>
                <Typography variant="h4" fontWeight={700} color="primary">
                  {metrics.total_appointments || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("platform.totalAppointments", { defaultValue: "Total Appointments" })}
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper elevation={1} sx={{ p: 2, textAlign: "center" }}>
                <Typography variant="h4" fontWeight={700} color="primary">
                  {metrics.total_prescriptions || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("platform.totalPrescriptions", { defaultValue: "Total Prescriptions" })}
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper elevation={1} sx={{ p: 2, textAlign: "center" }}>
                <Typography variant="h4" fontWeight={700} color="primary">
                  {metrics.total_admissions || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("platform.totalAdmissions", { defaultValue: "Total Admissions" })}
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper elevation={1} sx={{ p: 2, textAlign: "center" }}>
                <Typography variant="h4" fontWeight={700} color="primary">
                  {metrics.active_admissions || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("platform.activeAdmissions", { defaultValue: "Active Admissions" })}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Grid>

        {/* Limits */}
        <Grid size={{ xs: 12 }}>
          <Typography variant="h6" sx={{ mb: 2, mt: 2 }}>
            {t("platform.limits", { defaultValue: "Limits" })}
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">
                {t("platform.maxUsers", { defaultValue: "Max Users" })}
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {tenantData.max_users ?? "∞"}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">
                {t("platform.currentUsers", { defaultValue: "Current Users" })}
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {metrics.user_count || 0}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">
                {t("platform.maxPatients", { defaultValue: "Max Patients" })}
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {tenantData.max_patients ?? "∞"}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">
                {t("platform.currentPatients", { defaultValue: "Current Patients" })}
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {metrics.total_patients || 0}
              </Typography>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TenantsManagementPage;
