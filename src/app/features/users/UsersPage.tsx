// src/app/features/users/UsersPage.tsx
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
  Chip,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Tooltip,
  TablePagination,
  Stack,
  TableSortLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Divider,
} from "@mui/material";
import {
  Edit as EditIcon,
  Add as AddIcon,
  Inbox as EmptyIcon,
  LockReset as LockResetIcon,
  Person as PersonIcon,
  PowerSettingsNew as PowerSettingsNewIcon,
  PowerOff as PowerOffIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
  Email as EmailIcon,
} from "@mui/icons-material";
import PermissionGuard from "@app/components/common/PermissionGuard";
import PageToolbar from "@app/components/common/PageToolbar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@app/lib/apiClient";
import { forcePasswordChange, toggleUserActive, getUser, resendInvitation } from "@app/lib/api/users";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@app/store/authStore";
import { can } from "@app/lib/abac";
import { useToast } from "@app/components/common/ToastProvider";
import UserFormDialog from "./UserFormDialog";
import ConfirmationDialog from "@app/components/common/ConfirmationDialog";
import Grid from "@mui/material/Grid";

interface Role {
  name: string;
  permissions: Array<{ code: string }>;
}

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  department?: string | null;
  specialization?: string | null;
  status: "ACTIVE" | "INACTIVE" | "LOCKED" | "PASSWORD_EXPIRED";
  is_active: boolean;
  is_deleted: boolean;
  must_change_password: boolean;
  email_verified: boolean;
  roles: Role[];
  created_at: string;
  updated_at: string;
  tenant_name?: string | null;
}

type SortKey = "name" | "email";

const fetchUsers = async (search?: string, includeInactive?: boolean): Promise<User[]> => {
  const params: any = {};
  if (search) params.search = search;
  if (includeInactive) params.include_inactive = true;
  const res = await apiClient.get<User[]>("/users", { params });
  return res.data;
};

const UsersPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const user = useAuthStore((s) => s.user);
  const [openDialog, setOpenDialog] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<User | null>(null);
  
  // Search with debouncing
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  
  // Detail dialog
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);

  // Confirmation dialogs
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = React.useState(false);
  const [confirmActivateOpen, setConfirmActivateOpen] = React.useState(false);
  const [userToToggle, setUserToToggle] = React.useState<User | null>(null);
  const [confirmPasswordChangeOpen, setConfirmPasswordChangeOpen] = React.useState(false);
  const [userToPasswordChange, setUserToPasswordChange] = React.useState<User | null>(null);
  const [confirmResendOpen, setConfirmResendOpen] = React.useState(false);
  const [userToResend, setUserToResend] = React.useState<User | null>(null);

  // Filter state hooks
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("all");
  const [roleFilter, setRoleFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "inactive">("active");

  // Sorting
  const [sortBy, setSortBy] = React.useState<SortKey>("name");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");

  // Pagination
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  // Reset to first page when filters/search change
  React.useEffect(() => {
    setPage(0);
  }, [departmentFilter, roleFilter, statusFilter, search]);

  // Determine if we need to include inactive users
  const includeInactive = statusFilter === "all" || statusFilter === "inactive";

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["users", search, includeInactive],
    queryFn: () => fetchUsers(search, includeInactive),
    placeholderData: (prev) => prev, // Keep previous data while fetching to prevent layout shifts
  });

  // Debounce search input -> search, min 2 chars, keep focus
  React.useEffect(() => {
    const handle = setTimeout(() => {
      const v = searchInput.trim();
      if (v.length === 0 || v.length >= 2) {
        setSearch(v);
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // Restore focus after search query completes
  React.useEffect(() => {
    if (data !== undefined && searchInput && searchRef.current) {
      // Restore focus after query completes
      setTimeout(() => {
        if (searchRef.current && document.activeElement !== searchRef.current) {
          searchRef.current.focus();
        }
      }, 0);
    }
  }, [data, searchInput]);

  // Fetch user detail
  const { data: userDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["user", selectedUserId],
    queryFn: () => getUser(selectedUserId!),
    enabled: !!selectedUserId && detailOpen,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: toggleUserActive,
    
    onSuccess: (data: any) => {
      const name = [data?.first_name, data?.last_name].filter(Boolean).join(" ");
      const email = data?.email ?? "";
  
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user", data?.id] });
  
      showSuccess(
        t("notifications.userStatusUpdated", {
          defaultValue: "User: {{name}} ({{email}}) status updated successfully",
          name,
          email,
        })
      );
    },
    onError: (error: any) => {
      showError(
        error?.response?.data?.detail ||
          error?.message ||
          t("notifications.userStatusUpdateError", 
            { defaultValue: "Failed to update user status: {{name}} ({{email}})", 
              name: [userToToggle?.first_name, userToToggle?.last_name].filter(Boolean).join(" "), 
              email: userToToggle?.email ?? "", 
            }),
      );
    },
  });

  const forcePasswordChangeMutation = useMutation({
    mutationFn: forcePasswordChange,

    onSuccess: (data: any) => {
      const name = [data?.first_name, data?.last_name].filter(Boolean).join(" ");
      const email = data?.email ?? "";
  
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user"] });
      showSuccess(t("notifications.passwordChangeForced", { defaultValue: "User: {{name}} ({{email}}) will be required to change password on next login", name, email }));
    },
    onError: (error: any) => {
      showError(
        error?.response?.data?.detail || 
        t("notifications.passwordChangeForceError", { defaultValue: "Failed to force password change" })
      );
    },
  });

  const resendInvitationMutation = useMutation({
    mutationFn: resendInvitation,
    
    onSuccess: (data: any) => {
      const name = [data?.first_name, data?.last_name].filter(Boolean).join(" ");
      const email = data?.email ?? "";

      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user"] });
      // In demo mode, show password in toast
      if (data?.temp_password) {
        showSuccess(
          t("notifications.invitationSentWithPassword", { 
            defaultValue: "Invitation email sent successfully to {{name}} ({{email}}). Temporary Password: {{password}}",
            name,
            email,
            password: data.temp_password
          }),
          true // Don't auto-close
        );
      } else {
        showSuccess(t("notifications.invitationSent", { defaultValue: "Invitation email sent successfully to {{name}} ({{email}})", name, email }));
      }
    },
    onError: (error: any) => {
      showError(
        error?.response?.data?.detail || 
        t("notifications.invitationSendError", { defaultValue: "Failed to send invitation email" })
      );
    },
  });

  const users = data ?? [];
  const canCreate = can(user, "users:create");

  // Check permissions
  const canViewDepartments = user ? can(user, "departments:view") : false;

  // Fetch departments and roles for filters - only if user has permission
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await apiClient.get("/departments");
      return res.data;
    },
    enabled: canViewDepartments,
  });

  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await apiClient.get("/roles");
      return res.data;
    },
  });

  // Filter users based on filters (client-side filtering for department and role)
  const filteredUsers = React.useMemo(() => {
    let filtered = users;
    if (departmentFilter && departmentFilter !== "all") {
      filtered = filtered.filter((u) => u.department === departmentFilter);
    }
    if (roleFilter && roleFilter !== "all") {
      filtered = filtered.filter((u) =>
        u.roles.some((r) => r.name === roleFilter)
      );
    }
    // Status filtering is done server-side via include_inactive
    if (statusFilter === "active") {
      filtered = filtered.filter((u) => u.is_active);
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter((u) => !u.is_active);
    }
    return filtered;
  }, [users, departmentFilter, roleFilter, statusFilter]);

  // Sort users
  const sortedUsers = React.useMemo(() => {
    const sorted = [...filteredUsers];
    const dir = sortDirection === "asc" ? 1 : -1;

    sorted.sort((a, b) => {
      if (sortBy === "name") {
        const aName = `${a.first_name} ${a.last_name}`.toLowerCase();
        const bName = `${b.first_name} ${b.last_name}`.toLowerCase();
        return aName.localeCompare(bName) * dir;
      }
      if (sortBy === "email") {
        return a.email.toLowerCase().localeCompare(b.email.toLowerCase()) * dir;
      }
      return 0;
    });

    return sorted;
  }, [filteredUsers, sortBy, sortDirection]);

  // Pagination
  const pagedUsers = React.useMemo(() => {
    const start = page * rowsPerPage;
    return sortedUsers.slice(start, start + rowsPerPage);
  }, [sortedUsers, page, rowsPerPage]);

  // Reset to first page when filters change
  React.useEffect(() => {
    setPage(0);
  }, [departmentFilter, roleFilter, statusFilter, search]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDirection("asc");
    }
  };

  // Fetch tenant info to check limits
  const { data: tenantInfo } = useQuery({
    queryKey: ["tenant-info"],
    queryFn: async () => {
      const res = await apiClient.get("/auth/me");
      return res.data;
    },
  });

  const handleCreate = async () => {
    // Pre-check: Verify user limit before opening form
    if (tenantInfo?.tenant?.max_users !== null && tenantInfo?.tenant?.max_users !== undefined) {
      const currentUserCount = users.filter(u => !u.is_deleted).length;
      if (currentUserCount >= tenantInfo.tenant.max_users) {
        showError(
          t("users.maxUsersReached", {
            defaultValue: `Cannot create user. Maximum user limit (${tenantInfo.tenant.max_users}) has been reached. Please contact Platform Administrator to increase the limit.`,
            limit: tenantInfo.tenant.max_users,
          })
        );
        return;
      }
    }
    
    // Check if tenant is suspended
    if (tenantInfo?.tenant?.status === "SUSPENDED") {
      showError(
        t("users.tenantSuspended", {
          defaultValue: "Cannot create users. Hospital account is suspended. Please contact support.",
        })
      );
      return;
    }
    
    setEditingUser(null);
    setOpenDialog(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setOpenDialog(true);
  };

  const handleView = (user: User) => {
    setSelectedUserId(user.id);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelectedUserId(null);
  };

  const openDeactivateConfirm = (user: User) => {
    setUserToToggle(user);
    setConfirmDeactivateOpen(true);
  };

  const openActivateConfirm = (user: User) => {
    setUserToToggle(user);
    setConfirmActivateOpen(true);
  };

  const confirmDeactivate = () => {
    if (userToToggle) {
      toggleActiveMutation.mutate(userToToggle.id);
      setConfirmDeactivateOpen(false);
      setUserToToggle(null);
    }
  };

  const cancelDeactivateConfirm = () => {
    setConfirmDeactivateOpen(false);
    setUserToToggle(null);
  };

  const confirmActivate = () => {
    if (userToToggle) {
      toggleActiveMutation.mutate(userToToggle.id);
      setConfirmActivateOpen(false);
      setUserToToggle(null);
    }
  };

  const cancelActivateConfirm = () => {
    setConfirmActivateOpen(false);
    setUserToToggle(null);
  };

  const openPasswordChangeConfirm = (user: User) => {
    setUserToPasswordChange(user);
    setConfirmPasswordChangeOpen(true);
  };

  const confirmPasswordChange = () => {
    if (userToPasswordChange) {
      forcePasswordChangeMutation.mutate(userToPasswordChange.id);
      setConfirmPasswordChangeOpen(false);
      setUserToPasswordChange(null);
    }
  };

  const cancelPasswordChangeConfirm = () => {
    setConfirmPasswordChangeOpen(false);
    setUserToPasswordChange(null);
  };

  const openResendConfirm = (user: User) => {
    setUserToResend(user);
    setConfirmResendOpen(true);
  };

  const confirmResend = () => {
    if (userToResend) {
      resendInvitationMutation.mutate(userToResend.id);
      setConfirmResendOpen(false);
      setUserToResend(null);
    }
  };

  const cancelResendConfirm = () => {
    setConfirmResendOpen(false);
    setUserToResend(null);
  };

  // Check if resend invitation should be shown
  // Show only when: email is not verified
  const shouldShowResendInvitation = (user: User) => {
    return !user.email_verified;
  };

  // Check if user is HOSPITAL_ADMIN
  const isHospitalAdmin = (user: User) => {
    return user.roles?.some((r: Role) => r.name === "HOSPITAL_ADMIN") || false;
  };

  // Check if user can be deactivated
  // Cannot deactivate: HOSPITAL_ADMIN, self
  const canDeactivateUser = (targetUser: User) => {
    if (!targetUser.email_verified) return false; // Can't deactivate unverified users
    if (isHospitalAdmin(targetUser)) return false; // Cannot deactivate HOSPITAL_ADMIN
    if (targetUser.id === user?.id) return false; // Cannot deactivate self
    return true;
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUser(null);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  // Get status display - includes email verification status
  const getStatusDisplay = (user: User) => {
    if (!user.is_active) {
      return { label: t("users.inactive", { defaultValue: "Inactive" }), color: "default" as const };
    }
    // Check if user has other status issues
    if (user.status === "LOCKED") {
      return { label: t("users.locked", { defaultValue: "Locked" }), color: "error" as const };
    }
    if (user.status === "PASSWORD_EXPIRED") {
      return { label: t("users.passwordExpired", { defaultValue: "Password Expired" }), color: "warning" as const };
    }
    // If email not verified, show that status
    if (!user.email_verified) {
      return { label: t("users.emailNotVerified", { defaultValue: "Email Not Verified" }), color: "warning" as const };
    }
    return { label: t("users.active", { defaultValue: "Active" }), color: "success" as const };
  };

  return (
    <Box>
      <PageToolbar
        title={t("users.title", { defaultValue: "Users" })}
        subtitle={t("users.subtitle", {
          defaultValue: "Manage hospital staff, doctors, nurses, and administrators.",
        })}
        titleIcon={<PersonIcon sx={{ fontSize: 32 }} />}
        primaryAction={
          canCreate
            ? {
                label: t("users.create", { defaultValue: "Create User" }),
                onClick: handleCreate,
                icon: <AddIcon />,
              }
            : undefined
        }
      />
      {/* Search and Filters */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          mb: 3,
          alignItems: "center",
        }}
      >
        <TextField
          inputRef={searchRef}
          size="small"
          placeholder={t("users.searchPlaceholder", { defaultValue: "Search by name or email..." })}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          sx={{ minWidth: 200, flexGrow: 1, maxWidth: 300 }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="department-filter-label">{t("users.department", { defaultValue: "Department" })}</InputLabel>
          <Select
            labelId="department-filter-label"
            value={departmentFilter}
            label={t("users.department", { defaultValue: "Department" })}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <MenuItem value="all">{t("common.all", { defaultValue: "All" })}</MenuItem>
            {departments?.map((dept: any) => (
              <MenuItem key={dept.id} value={dept.name}>
                {dept.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="role-filter-label">{t("users.role", { defaultValue: "Role" })}</InputLabel>
          <Select
            labelId="role-filter-label"
            value={roleFilter}
            label={t("users.role", { defaultValue: "Role" })}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <MenuItem value="all">{t("common.all", { defaultValue: "All" })}</MenuItem>
            {roles?.map((role: any) => (
              <MenuItem key={role.id} value={role.name}>
                {role.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="status-filter-label">{t("users.status", { defaultValue: "Status" })}</InputLabel>
          <Select
            labelId="status-filter-label"
            value={statusFilter}
            label={t("users.status", { defaultValue: "Status" })}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
          >
            <MenuItem value="all">{t("common.all", { defaultValue: "All" })}</MenuItem>
            <MenuItem value="active">{t("users.active", { defaultValue: "Active" })}</MenuItem>
            <MenuItem value="inactive">{t("users.inactive", { defaultValue: "Inactive" })}</MenuItem>
          </Select>
        </FormControl>
      </Box>
      <Paper
        elevation={2}
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          border: "1px solid rgba(0, 0, 0, 0.05)",
          position: "relative",
        }}
      >
        {isFetching && !isLoading && (
          <Box
            sx={{
              position: "absolute",
              top: 8,
              right: 16,
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <CircularProgress size={16} />
          </Box>
        )}
        <TableContainer>
          {isLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <CircularProgress />
            </Box>
          ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "name"}
                    direction={sortBy === "name" ? sortDirection : "asc"}
                    onClick={() => handleSort("name")}
                  >
                    {t("users.name", { defaultValue: "Name" })}
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "email"}
                    direction={sortBy === "email" ? sortDirection : "asc"}
                    onClick={() => handleSort("email")}
                  >
                    {t("users.email", { defaultValue: "Email" })}
                  </TableSortLabel>
                </TableCell>
                <TableCell>{t("users.roles", { defaultValue: "Roles" })}</TableCell>
                <TableCell>{t("users.department", { defaultValue: "Department" })}</TableCell>
                <TableCell>{t("users.status", { defaultValue: "Status" })}</TableCell>
                <TableCell align="right">{t("common.actions", { defaultValue: "Actions" })}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <EmptyIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2, opacity: 0.5 }} />
                    <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                      {t("users.empty", { defaultValue: "No users found" })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("users.emptyDescription", {
                        defaultValue: search
                          ? "Try adjusting your search criteria."
                          : "Get started by creating your first user.",
                      })}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                pagedUsers.map((u) => {
                  const statusDisplay = getStatusDisplay(u);
                  return (
                    <TableRow key={u.id} hover onClick={() => handleView(u)} sx={{ cursor: "pointer" }}>
                      <TableCell>
                        {u.first_name} {u.last_name}
                      </TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        {u.roles.map((role) => (
                          <Chip
                            key={role.name}
                            label={role.name}
                            size="small"
                            sx={{ mr: 0.5, mb: 0.5, borderRadius: 2 }}
                          />
                        ))}
                      </TableCell>
                      <TableCell>{u.department || "-"}</TableCell>
                      <TableCell>
                        <Chip
                          label={statusDisplay.label}
                          size="small"
                          color={statusDisplay.color}
                          sx={{ borderRadius: 2 }}
                        />
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title={t("common.view", { defaultValue: "View details" })}>
                            <IconButton
                              size="small"
                              onClick={() => handleView(u)}
                              sx={{ borderRadius: 1 }}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <PermissionGuard permission="users:update">
                            <Tooltip title={t("common.edit", { defaultValue: "Edit" })}>
                              <IconButton
                                size="small"
                                onClick={() => handleEdit(u)}
                                sx={{ borderRadius: 1 }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </PermissionGuard>
                          {shouldShowResendInvitation(u) && (
                            <PermissionGuard permission="users:update">
                              <Tooltip title={t("users.resendInvitation", { defaultValue: "Resend invitation" })}>
                                <IconButton
                                  size="small"
                                  onClick={() => openResendConfirm(u)}
                                  sx={{ borderRadius: 1 }}
                                >
                                  <EmailIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </PermissionGuard>
                          )}
                          {u.email_verified && (
                            <PermissionGuard permission="users:update">
                              <Tooltip title={t("users.forcePasswordChange", { defaultValue: "Force password change" })}>
                                <IconButton
                                  size="small"
                                  onClick={() => openPasswordChangeConfirm(u)}
                                  sx={{ borderRadius: 1 }}
                                >
                                  <LockResetIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </PermissionGuard>
                          )}
                          {u.email_verified && canDeactivateUser(u) && (
                            <PermissionGuard permission="users:update">
                              <Tooltip title={u.is_active ? t("common.deactivate", { defaultValue: "Deactivate" }) : t("common.activate", { defaultValue: "Activate" })}>
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    if (u.is_active) openDeactivateConfirm(u);
                                    else openActivateConfirm(u);
                                  }}
                                  disabled={toggleActiveMutation.isPending}
                                  sx={{ borderRadius: 1 }}
                                >
                                  {u.is_active ? (
                                    <PowerOffIcon fontSize="small" color="action" />
                                  ) : (
                                    <PowerSettingsNewIcon fontSize="small" color="success" />
                                  )}
                                </IconButton>
                              </Tooltip>
                            </PermissionGuard>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          )}
        </TableContainer>

        {/* Pagination */}
        <TablePagination
          component="div"
          count={filteredUsers.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      </Paper>
      <UserFormDialog
        open={openDialog}
        onClose={handleCloseDialog}
        onCreated={() => {
          // Child dialog already showed success toast
          // Parent only needs to close dialog and refresh data
          handleCloseDialog();
        }}
        onUpdated={() => {
          // Child dialog already showed success toast
          // Parent only needs to close dialog and refresh data
          handleCloseDialog();
        }}
        user={editingUser}
      />
      {/* Detail Dialog */}
      <Dialog open={detailOpen} onClose={closeDetail} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="h6">
              {t("users.details", { defaultValue: "User Details" })}
            </Typography>
            <IconButton onClick={closeDetail} size="large">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {detailLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : !userDetail ? (
            <Alert severity="error">
              {t("common.loadError", { defaultValue: "Unable to load details." })}
            </Alert>
          ) : (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    {t("users.personalInfo", { defaultValue: "Personal Information" })}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t("users.name", { defaultValue: "Name" })}
                      </Typography>
                      <Typography variant="body1">
                        {userDetail.first_name} {userDetail.last_name}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t("users.email", { defaultValue: "Email" })}
                      </Typography>
                      <Typography variant="body1">{userDetail.email}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t("users.phone", { defaultValue: "Phone" })}
                      </Typography>
                      <Typography variant="body1">{userDetail.phone || "-"}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t("users.status", { defaultValue: "Status" })}
                      </Typography>
                      <Box sx={{ mt: 0.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
                        <Chip
                          label={getStatusDisplay(userDetail).label}
                          size="small"
                          color={getStatusDisplay(userDetail).color}
                          sx={{ borderRadius: 2 }}
                        />
                        {!userDetail.email_verified && (
                          <Chip
                            label={t("users.emailNotVerified", { defaultValue: "Email Not Verified" })}
                            size="small"
                            color="warning"
                            sx={{ borderRadius: 2 }}
                          />
                        )}
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    {t("users.workInfo", { defaultValue: "Work Information" })}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t("users.department", { defaultValue: "Department" })}
                      </Typography>
                      <Typography variant="body1">{userDetail.department || "-"}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t("users.specialization", { defaultValue: "Specialization" })}
                      </Typography>
                      <Typography variant="body1">{userDetail.specialization || "-"}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                        {t("users.roles", { defaultValue: "Roles" })}
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {userDetail.roles && userDetail.roles.length > 0 ? (
                          userDetail.roles.map((role: Role) => (
                            <Chip
                              key={role.name}
                              label={role.name}
                              size="small"
                              sx={{ borderRadius: 2 }}
                            />
                          ))
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    {t("users.accountInfo", { defaultValue: "Account Information" })}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t("users.createdAt", { defaultValue: "Created At" })}
                      </Typography>
                      <Typography variant="body1">
                        {userDetail.created_at
                          ? new Date(userDetail.created_at).toLocaleString()
                          : "-"}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t("users.updatedAt", { defaultValue: "Updated At" })}
                      </Typography>
                      <Typography variant="body1">
                        {userDetail.updated_at
                          ? new Date(userDetail.updated_at).toLocaleString()
                          : "-"}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t("users.emailVerified", { defaultValue: "Email Verified" })}
                      </Typography>
                      <Box sx={{ mt: 0.5 }}>
                        <Chip
                          label={userDetail.email_verified ? t("common.yes", { defaultValue: "Yes" }) : t("common.no", { defaultValue: "No" })}
                          size="small"
                          color={userDetail.email_verified ? "success" : "warning"}
                          sx={{ borderRadius: 2 }}
                        />
                      </Box>
                    </Grid>
                    {userDetail.must_change_password && (
                      <Grid size={{ xs: 12 }}>
                        <Alert severity="warning" sx={{ mt: 1 }}>
                          {t("users.mustChangePassword", {
                            defaultValue: "User must change password on next login",
                          })}
                        </Alert>
                      </Grid>
                    )}
                    {!userDetail.email_verified && (
                      <Grid size={{ xs: 12 }}>
                        <Alert severity="info" sx={{ mt: 1 }}>
                          {t("users.emailNotVerifiedMessage", {
                            defaultValue: "User has not logged in yet. Email will be verified when they log in with the temporary password.",
                          })}
                        </Alert>
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDetail} variant="outlined">
            {t("common.close", { defaultValue: "Close" })}
          </Button>
          {userDetail && (
            <PermissionGuard permission="users:update">
              <Button
                variant="contained"
                onClick={() => {
                  setEditingUser(userDetail as any);
                  setDetailOpen(false);
                  setOpenDialog(true);
                }}
                startIcon={<EditIcon />}
              >
                {t("common.edit", { defaultValue: "Edit" })}
              </Button>
            </PermissionGuard>
          )}
        </DialogActions>
      </Dialog>
      {/* Confirm Deactivate */}
      <ConfirmationDialog
        open={confirmDeactivateOpen}
        title={t("users.confirmDeactivateTitle", { defaultValue: "Deactivate User" })}
        message={
          userToToggle
            ? t("users.confirmDeactivate", {
                defaultValue: `Are you sure you want to deactivate "${userToToggle.first_name} ${userToToggle.last_name} (${userToToggle.email})"?`,
                name: `${userToToggle.first_name} ${userToToggle.last_name}`,
                email: userToToggle.email,
              })
            : ""
        }
        confirmText={t("common.deactivate", { defaultValue: "Deactivate" })}
        cancelText={t("common.cancel", { defaultValue: "Cancel" })}
        onConfirm={confirmDeactivate}
        onClose={cancelDeactivateConfirm}
        confirmColor="error"
        isLoading={toggleActiveMutation.isPending}
      />
      {/* Confirm Activate */}
      <ConfirmationDialog
        open={confirmActivateOpen}
        title={t("users.confirmActivateTitle", { defaultValue: "Activate User" })}
        message={
          userToToggle
            ? t("users.confirmActivate", {
                defaultValue: `Are you sure you want to activate the user: ${userToToggle.first_name} ${userToToggle.last_name} (${userToToggle.email})?`,
                name: `${userToToggle.first_name} ${userToToggle.last_name}`,
                email: userToToggle.email,
              })
            : ""
        }
        confirmText={t("common.activate", { defaultValue: "Activate" })}
        cancelText={t("common.cancel", { defaultValue: "Cancel" })}
        onConfirm={confirmActivate}
        onClose={cancelActivateConfirm}
        confirmColor="success"
        isLoading={toggleActiveMutation.isPending}
      />
      {/* Confirm Resend Invitation */}
      <ConfirmationDialog
        open={confirmResendOpen}
        title={t("users.confirmResendInvitationTitle", { defaultValue: "Resend Invitation" })}
        message={
          userToResend
            ? t("users.confirmResendInvitation", {
                defaultValue: `Resend invitation email to ${userToResend.email}? A new temporary password will be generated.`,
                email: userToResend.email,
              })
            : ""
        }
        confirmText={t("common.send", { defaultValue: "Send" })}
        cancelText={t("common.cancel", { defaultValue: "Cancel" })}
        onConfirm={confirmResend}
        onClose={cancelResendConfirm}
        confirmColor="primary"
        isLoading={resendInvitationMutation.isPending}
      />
      {/* Confirm Force Password Change */}
      <ConfirmationDialog
        open={confirmPasswordChangeOpen}
        title={t("users.confirmForcePasswordChangeTitle", { defaultValue: "Force Password Change" })}
        message={
          userToPasswordChange
            ? t("users.confirmForcePasswordChange", {
                defaultValue: `Force password change for ${userToPasswordChange.email}? They will be required to change password on next login.`,
                email: userToPasswordChange.email,
              })
            : ""
        }
        confirmText={t("common.confirm", { defaultValue: "Confirm" })}
        cancelText={t("common.cancel", { defaultValue: "Cancel" })}
        onConfirm={confirmPasswordChange}
        onClose={cancelPasswordChangeConfirm}
        confirmColor="warning"
        isLoading={forcePasswordChangeMutation.isPending}
      />
    </Box>
  );
};

export default UsersPage;
