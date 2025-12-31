// src/app/features/departments/DepartmentsPage.tsx
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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Chip,
} from "@mui/material";
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, Inbox as EmptyIcon, Business as BusinessIcon } from "@mui/icons-material";
import Tooltip from "@mui/material/Tooltip";
import PermissionGuard from "@app/components/common/PermissionGuard";
import PageToolbar from "@app/components/common/PageToolbar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@app/lib/apiClient";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@app/store/authStore";
import { can } from "@app/lib/abac";
import { useToast } from "@app/components/common/ToastProvider";
import DepartmentFormDialog from "./DepartmentFormDialog";

interface Department {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  user_count?: number;
  patient_count?: number;
  is_system?: boolean;
  is_for_staff?: boolean;
  is_for_patients?: boolean;
}

const fetchDepartments = async (): Promise<Department[]> => {
  const res = await apiClient.get<Department[]>("/departments");
  return res.data;
};

const DepartmentsPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const user = useAuthStore((s) => s.user);
  const [openDialog, setOpenDialog] = React.useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = React.useState(false);
  const [selectedDepartment, setSelectedDepartment] = React.useState<Department | null>(null);
  const [departmentToDelete, setDepartmentToDelete] = React.useState<Department | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: fetchDepartments,
  });

  const deleteMutation = useMutation({
    mutationFn: async (departmentId: string) => {
      await apiClient.delete(`/departments/${departmentId}`);
    },
    onSuccess: (_, departmentId) => {
      const deletedDepartment = departments.find(d => d.id === departmentId);
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      showSuccess(t("notifications.departmentDeleted", { defaultValue: "Department: {{name}} deleted successfully.", name: deletedDepartment?.name || "Department" }));
    },
    onError: (error: any, departmentId) => {
      const deletedDepartment = departments.find(d => d.id === departmentId);
      showError(
        error?.response?.data?.detail ||
        t("notifications.departmentDeleteError", { defaultValue: "Failed to delete department: {{name}}.", name: deletedDepartment?.name || "Department" })
      );
    },
  });

  const departments = data ?? [];
  const canCreate = can(user, "departments:create");

  const handleCreate = () => {
    setSelectedDepartment(null);
    setOpenDialog(true);
  };

  const handleEdit = (department: Department) => {
    setSelectedDepartment(department);
    setOpenDialog(true);
  };

  const handleDelete = (department: Department) => {
    setDepartmentToDelete(department);
    setOpenDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (departmentToDelete) {
      deleteMutation.mutate(departmentToDelete.id);
      setOpenDeleteDialog(false);
      setDepartmentToDelete(null);
    }
  };

  const cancelDelete = () => {
    setOpenDeleteDialog(false);
    setDepartmentToDelete(null);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedDepartment(null);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageToolbar
        title={t("departments.title", { defaultValue: "Departments" })}
        subtitle={t("departments.subtitle", {
          defaultValue: "Manage hospital departments and their details.",
        })}
        titleIcon={<BusinessIcon sx={{ fontSize: 32 }} />}
        primaryAction={
          canCreate
            ? {
                label: t("departments.create", { defaultValue: "Create Department" }),
                onClick: handleCreate,
                icon: <AddIcon />,
              }
            : undefined
        }
      />

      <Paper
        elevation={2}
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          border: "1px solid rgba(0, 0, 0, 0.05)",
        }}
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("departments.name", { defaultValue: "Name" })}</TableCell>
                <TableCell>{t("departments.description", { defaultValue: "Description" })}</TableCell>
                <TableCell>{t("departments.availability", { defaultValue: "Availability" })}</TableCell>
                <TableCell align="right">{t("common.actions", { defaultValue: "Actions" })}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {departments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 8 }}>
                    <EmptyIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2, opacity: 0.5 }} />
                    <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                      {t("departments.empty", { defaultValue: "No departments found" })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("departments.emptyDescription", {
                        defaultValue: "Get started by creating your first department.",
                      })}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                departments.map((dept) => (
                  <TableRow key={dept.id} hover>
                    <TableCell>
                      <Typography fontWeight={600}>{dept.name}</Typography>
                    </TableCell>
                    <TableCell>{dept.description || "-"}</TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                        {dept.is_for_staff !== false && (
                          <Chip
                            label={t("departments.forStaff", { defaultValue: "Staff" })}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        )}
                        {dept.is_for_patients !== false && (
                          <Chip
                            label={t("departments.forPatients", { defaultValue: "Patients" })}
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        )}
                        {dept.is_for_staff === false && dept.is_for_patients === false && (
                          <Typography variant="caption" color="text.secondary">
                            {t("departments.notAvailable", { defaultValue: "Not available" })}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                        <PermissionGuard permission="departments:update">
                          <IconButton
                            size="small"
                            onClick={() => handleEdit(dept)}
                            sx={{ borderRadius: 1 }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </PermissionGuard>
                        <PermissionGuard permission="departments:delete">
                          <Tooltip
                            title={
                              dept.is_system
                                ? t("departments.cannotDeleteSystem", {
                                    defaultValue: "Cannot delete Administrator department",
                                  })
                                : (dept.user_count || 0) > 0 || (dept.patient_count || 0) > 0
                                ? t("departments.cannotDeleteWithUsers", {
                                    defaultValue: `Cannot delete. ${dept.user_count || 0} user(s) and ${dept.patient_count || 0} patient(s) assigned.`,
                                    userCount: dept.user_count || 0,
                                    patientCount: dept.patient_count || 0,
                                  })
                                : t("common.delete", { defaultValue: "Delete" })
                            }
                          >
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleDelete(dept)}
                                disabled={dept.is_system || (dept.user_count || 0) > 0 || (dept.patient_count || 0) > 0}
                                sx={{ borderRadius: 1 }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </PermissionGuard>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <DepartmentFormDialog
        open={openDialog}
        onClose={handleCloseDialog}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["departments"] });
          handleCloseDialog();
        }}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["departments"] });
          handleCloseDialog();
        }}
        department={selectedDepartment}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={cancelDelete}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t("departments.confirmDeleteTitle", { defaultValue: "Delete Department" })}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("departments.confirmDeleteMessage", {
              defaultValue: "Are you sure you want to delete the department \"{{name}}\"? This action cannot be undone.",
              name: departmentToDelete?.name || "",
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDelete} color="inherit">
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            onClick={confirmDelete}
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending
              ? t("common.deleting", { defaultValue: "Deleting..." })
              : t("common.delete", { defaultValue: "Delete" })}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DepartmentsPage;

