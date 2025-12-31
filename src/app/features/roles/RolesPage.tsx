// src/app/features/roles/RolesPage.tsx
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
  Chip,
} from "@mui/material";
import { Edit as EditIcon, Add as AddIcon, Inbox as EmptyIcon, Delete as DeleteIcon, Lock as LockIcon, AssignmentInd as AssignmentIndIcon, PowerSettingsNew as PowerSettingsNewIcon, PowerOff as PowerOffIcon } from "@mui/icons-material";
import PageToolbar from "@app/components/common/PageToolbar";
import PermissionGuard from "@app/components/common/PermissionGuard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@app/lib/apiClient";
import { useTranslation } from "react-i18next";
import { useToast } from "@app/components/common/ToastProvider";
import Tooltip from "@mui/material/Tooltip";
import { useAuthStore } from "@app/store/authStore";
import { can } from "@app/lib/abac";
import RoleFormDialog from "./RoleFormDialog";
import ConfirmationDialog from "@app/components/common/ConfirmationDialog";

interface Permission {
  code: string;
  name: string;
  category: string;
}

interface Role {
  id: string;
  name: string;
  description?: string | null;
  is_system: boolean;
  system_key?: string | null;
  is_active?: boolean;
  permissions: Permission[];
  created_at: string;
  updated_at: string;
}

const fetchRoles = async (): Promise<Role[]> => {
  const res = await apiClient.get<Role[]>("/roles");
  return res.data;
};

const RolesPage: React.FC = () => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [openDialog, setOpenDialog] = React.useState(false);
  const [selectedRole, setSelectedRole] = React.useState<Role | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: fetchRoles,
  });

  const roles = data ?? [];
  const canCreate = can(user, "roles:create");
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (roleId: string) => {
      await apiClient.delete(`/roles/${roleId}`);
    },
    onSuccess: (_, roleId) => {
      const roleName = roles.find(r => r.id === roleId)?.name || "Role";
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      showSuccess(t("notifications.roleDeleted", { defaultValue: `Role "${roleName}" deleted successfully` }));
    },
    onError: (error: any, roleId) => {
      const roleName = roles.find(r => r.id === roleId)?.name || "Role";
      showError(
        error?.response?.data?.detail || 
        t("notifications.roleDeleteError", { defaultValue: `Failed to delete role "${roleName}"` })
      );
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (roleId: string) => {
      await apiClient.patch(`/roles/${roleId}/toggle-active`);
    },
    onSuccess: (_, roleId) => {
      const role = roles.find(r => r.id === roleId);
      const roleName = role?.name || "Role";
      const isActive = role?.is_active;
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      showSuccess(
        t("notifications.roleToggled", { 
          defaultValue: `Role "${roleName}" ${isActive ? "disabled" : "enabled"} successfully` 
        })
      );
    },
    onError: (error: any, roleId) => {
      const roleName = roles.find(r => r.id === roleId)?.name || "Role";
      showError(
        error?.response?.data?.detail ||
        t("notifications.roleToggleError", { defaultValue: `Failed to toggle role "${roleName}"` })
      );
    },
  });

  const handleCreate = () => {
    setSelectedRole(null);
    setOpenDialog(true);
  };

  const handleEdit = (role: Role) => {
    setSelectedRole(role);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedRole(null);
  };

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [roleToDelete, setRoleToDelete] = React.useState<Role | null>(null);
  const [toggleDialogOpen, setToggleDialogOpen] = React.useState(false);
  const [roleToToggle, setRoleToToggle] = React.useState<Role | null>(null);

  const handleDelete = (role: Role) => {
    setRoleToDelete(role);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (roleToDelete) {
      deleteMutation.mutate(roleToDelete.id);
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
    }
  };

  const handleToggleActive = (role: Role) => {
    setRoleToToggle(role);
    setToggleDialogOpen(true);
  };

  const confirmToggle = () => {
    if (roleToToggle) {
      toggleActiveMutation.mutate(roleToToggle.id);
      setToggleDialogOpen(false);
      setRoleToToggle(null);
    }
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
        title={t("roles.title", { defaultValue: "Roles" })}
        subtitle={t("roles.subtitle", {
          defaultValue: "Manage user roles and their assigned permissions.",
        })}
        titleIcon={<AssignmentIndIcon sx={{ fontSize: 32 }} />}
        primaryAction={
          canCreate
            ? {
                label: t("roles.create", { defaultValue: "Create Role" }),
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
                <TableCell>{t("roles.name", { defaultValue: "Name" })}</TableCell>
                <TableCell>{t("roles.description", { defaultValue: "Description" })}</TableCell>
                <TableCell>{t("roles.permissions", { defaultValue: "Permissions" })}</TableCell>
                <TableCell align="right">{t("common.actions", { defaultValue: "Actions" })}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 8 }}>
                    <EmptyIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2, opacity: 0.5 }} />
                    <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                      {t("roles.empty", { defaultValue: "No roles found" })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("roles.emptyDescription", {
                        defaultValue: "Get started by creating your first role.",
                      })}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.id} hover>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {role.is_system && (
                          <Tooltip title={t("roles.systemRoleTooltip", { 
                            defaultValue: "System role – cannot be renamed or deleted. To customize, create a new role from this template." 
                          })}>
                            <LockIcon fontSize="small" color="action" />
                          </Tooltip>
                        )}
                        <Typography fontWeight={600}>{role.name}</Typography>
                        {role.is_system && (
                          <Chip
                            label={t("roles.systemRole", { defaultValue: "System" })}
                            size="small"
                            color="primary"
                            sx={{ borderRadius: 2 }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{role.description || "-"}</TableCell>
                    <TableCell>
                      <Tooltip
                        title={
                          role.permissions.length > 0
                            ? role.permissions.map(p => {
                                // Capitalize permission code for display
                                const parts = p.code.split(':');
                                const action = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : '';
                                const resource = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : '';
                                return `${action} ${resource}`;
                              }).join(", ")
                            : "No permissions"
                        }
                        arrow
                      >
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                          {role.permissions.slice(0, 3).map((perm) => {
                            // Capitalize permission code for display
                            const parts = perm.code.split(':');
                            const action = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : '';
                            const resource = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : '';
                            const displayCode = `${action} ${resource}`;
                            return (
                              <Chip
                                key={perm.code}
                                label={displayCode}
                                size="small"
                                sx={{ borderRadius: 2 }}
                              />
                            );
                          })}
                          {role.permissions.length > 3 && (
                            <Chip
                              label={`+${role.permissions.length - 3}`}
                              size="small"
                              sx={{ borderRadius: 2 }}
                            />
                          )}
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                        {!role.is_system && (
                          <PermissionGuard permission="roles:update">
                            <Tooltip title={role.is_active ? t("roles.disableRole", { defaultValue: "Disable role" }) : t("roles.enableRole", { defaultValue: "Enable role" })}>
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => handleToggleActive(role)}
                                  disabled={toggleActiveMutation.isPending}
                                  color={role.is_active ? "success" : "default"}
                                  sx={{ borderRadius: 1 }}
                                >
                                  {role.is_active ? (
                                    <PowerSettingsNewIcon fontSize="small" />
                                  ) : (
                                    <PowerOffIcon fontSize="small" />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                          </PermissionGuard>
                        )}
                        <PermissionGuard permission="roles:update">
                          <Tooltip title={role.is_system ? t("roles.cannotEditSystem", { defaultValue: "Cannot edit system role" }) : t("common.edit", { defaultValue: "Edit" })}>
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleEdit(role)}
                                disabled={role.is_system}
                                sx={{ borderRadius: 1 }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </PermissionGuard>
                        <PermissionGuard permission="roles:delete">
                          <Tooltip title={role.is_system ? t("roles.cannotDeleteSystem", { defaultValue: "Cannot delete system role" }) : t("common.delete", { defaultValue: "Delete" })}>
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleDelete(role)}
                                disabled={role.is_system}
                                color="error"
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

      <RoleFormDialog
        open={openDialog}
        onClose={handleCloseDialog}
        role={selectedRole}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setRoleToDelete(null);
        }}
        onConfirm={confirmDelete}
        title={t("roles.confirmDeleteTitle", { defaultValue: "Delete Role" })}
        message={t("roles.confirmDelete", {
          defaultValue: `Are you sure you want to delete the role "${roleToDelete?.name}"? This action cannot be undone.`,
          name: roleToDelete?.name || "",
        })}
        confirmText={t("common.delete", { defaultValue: "Delete" })}
        confirmColor="error"
        isLoading={deleteMutation.isPending}
      />

      <ConfirmationDialog
        open={toggleDialogOpen}
        onClose={() => {
          setToggleDialogOpen(false);
          setRoleToToggle(null);
        }}
        onConfirm={confirmToggle}
        title={t("roles.confirmToggleTitle", { 
          defaultValue: roleToToggle?.is_active ? "Disable Role" : "Enable Role" 
        })}
        message={t("roles.confirmToggle", {
          defaultValue: `Are you sure you want to ${roleToToggle?.is_active ? "disable" : "enable"} the role "${roleToToggle?.name}"?`,
          name: roleToToggle?.name || "",
          action: roleToToggle?.is_active ? "disable" : "enable",
        })}
        confirmText={roleToToggle?.is_active ? t("common.disable", { defaultValue: "Disable" }) : t("common.enable", { defaultValue: "Enable" })}
        confirmColor={roleToToggle?.is_active ? "warning" : "success"}
        isLoading={toggleActiveMutation.isPending}
      />
    </Box>
  );
};

export default RolesPage;


