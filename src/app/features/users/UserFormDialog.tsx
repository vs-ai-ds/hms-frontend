// src/app/features/users/UserFormDialog.tsx
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  FormHelperText,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiClient } from "@app/lib/apiClient";
import { useTranslation } from "react-i18next";
import { useToast } from "@app/components/common/ToastProvider";
import { useAuthStore } from "@app/store/authStore";
import { can } from "@app/lib/abac";
import { updateUser, createUser } from "@app/lib/api/users";

// Validation regex patterns matching registration form
const nameRegex = /^[a-zA-Z\u00C0-\u017F\s.'-]+$/;
const phoneRegex = /^[0-9+\-\s]{5,15}$/;

// Helper to validate phone digits (8-15 digits)
const validatePhoneDigits = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
};

const schema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Invalid email address"),
  first_name: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(50, "First name must be 1-50 characters")
    .regex(
      nameRegex,
      "First name can only contain letters, spaces, periods, apostrophes, and hyphens"
    ),
  last_name: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(50, "Last name must be 1-50 characters")
    .regex(
      nameRegex,
      "Last name can only contain letters, spaces, periods, apostrophes, and hyphens"
    ),
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .refine((val) => phoneRegex.test(val), {
      message: "Phone must be 5-15 characters and contain only digits, spaces, + or -",
    })
    .refine((val) => validatePhoneDigits(val), {
      message: "Phone must be 8-15 digits (remove spaces or symbols)",
    }),
  department: z.string().trim().min(1, "Department is required"),
  specialization: z.string().trim().optional(),
  roles: z.array(z.string()).min(1, "At least one role is required"),
});

type FormValues = z.infer<typeof schema>;

interface Role {
  name: string;
  permissions: Array<{ code: string }>;
}

interface UserFormDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void; // Optional callback for parent to close and refresh
  onUpdated?: () => void; // Optional callback for parent to close and refresh
  user?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone?: string | null;
    department?: string | null;
    specialization?: string | null;
    roles: Role[] | string[]; // Support both formats for backward compatibility
  } | null;
}

const UserFormDialog: React.FC<UserFormDialogProps> = ({
  open,
  onClose,
  onCreated,
  onUpdated,
  user,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  
  // Check if editing HOSPITAL_ADMIN user
  const isEditingHospitalAdmin = user && user.roles?.some((r: any) => {
    const roleName = typeof r === 'string' ? r : (r?.name || r);
    return roleName === "HOSPITAL_ADMIN";
  });
  const { showSuccess, showError } = useToast();
  const isEdit = !!user;

  // Check permissions
  const canViewDepartments = currentUser ? can(currentUser, "departments:view") : false;
  const canViewRoles = currentUser ? can(currentUser, "roles:view") : false;

  // Fetch departments for dropdown - only show departments available for staff
  // Only fetch if user has permission
  const { data: departments, isLoading: loadingDepartments } = useQuery({
    queryKey: ["departments", "staff"],
    queryFn: async () => {
      const res = await apiClient.get("/departments", {
        params: { for_staff: true },
      });
      return res.data;
    },
    enabled: open && canViewDepartments,
  });

  // Fetch roles for dropdown (includes both system and custom roles)
  // Only fetch if user has permission
  const { data: roles, isLoading: loadingRoles } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await apiClient.get("/roles");
      return res.data;
    },
    enabled: open && canViewRoles,
    select: (data) => {
      // Filter to only active roles and return just the names
      return data?.filter((role: any) => role.is_active !== false).map((role: any) => role.name) || [];
    },
  });

  // Helper to extract role names from role objects or strings
  const getRoleNames = (roles: Role[] | string[]): string[] => {
    if (!roles || roles.length === 0) return [];
    // Check if first item is a string (old format) or object (new format)
    if (typeof roles[0] === "string") {
      return roles as string[];
    }
    return (roles as Role[]).map((r) => r.name);
  };

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitted },
    trigger,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur", // Validate on blur
    defaultValues: user
      ? {
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          phone: user.phone || "",
          department: user.department || "",
          specialization: user.specialization || "",
          roles: getRoleNames(user.roles),
        }
      : {
          email: "",
          first_name: "",
          last_name: "",
          phone: "",
          department: "",
          specialization: "",
          roles: [],
        },
  });

  React.useEffect(() => {
    if (user) {
      // Handle department mismatch - if user has "Administration" but departments list has "Administrator"
      let userDepartment = user.department || "";
      if (departments && departments.length > 0) {
        // Check if user's department exists in the list
        const deptExists = departments.some((d: any) => d.name === userDepartment);
        if (!deptExists && userDepartment === "Administration") {
          // Try to find "Administrator" as fallback
          const adminDept = departments.find((d: any) => d.name === "Administrator");
          if (adminDept) {
            userDepartment = "Administrator";
          }
        }
        // If still not found, use first available department
        if (!deptExists && !departments.some((d: any) => d.name === userDepartment)) {
          userDepartment = departments[0]?.name || "";
        }
      }
      
      reset({
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone || "",
        department: userDepartment,
        specialization: user.specialization || "",
        roles: getRoleNames(user.roles),
      });
    } else {
      reset({
        email: "",
        first_name: "",
        last_name: "",
        phone: "",
        department: "",
        specialization: "",
        roles: [],
      });
    }
  }, [user, reset, departments]);

  const createMutation = useMutation({
    mutationFn: (payload: FormValues) => createUser(payload),
  
    onSuccess: (data: any) => {
      const name =
        [data?.first_name, data?.last_name].filter(Boolean).join(" ") ||
        t("users.unknown", { defaultValue: "User" });
  
      const email = data?.email ?? "";
  
      queryClient.invalidateQueries({ queryKey: ["users"] });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ["user", data.id] });
      }
  
      // Show success toast (single source of truth - child dialog shows toast)
      if (data?.temp_password) {
        showSuccess(
          t("notifications.userCreatedWithPassword", {
            defaultValue:
              "User: {{name}} ({{email}}) created successfully. Temporary Password: {{password}}",
            name,
            email,
            password: data.temp_password,
          }),
          true // don't auto-close
        );
      } else {
        showSuccess(
          t("notifications.userCreated", {
            defaultValue: "User: {{name}} ({{email}}) created successfully",
            name,
            email,
          })
        );
      }
  
      // Let parent close dialog (don't call onClose here)
      onCreated?.();
    },
  
    onError: (error: any) => {
      showError(
        error?.response?.data?.detail ||
          error?.message ||
          t("notifications.userCreateError", {
            defaultValue: "Failed to create user",
          })
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: FormValues) => updateUser(user!.id, payload),
  
    onSuccess: (data: any) => {
      const name =
        [data?.first_name, data?.last_name].filter(Boolean).join(" ") ||
        [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
        t("users.unknown", { defaultValue: "User" });
  
      const email = data?.email ?? user?.email ?? "";
  
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user", user!.id] });
  
      // Show success toast (single source of truth - child dialog shows toast)
      showSuccess(
        t("notifications.userUpdated", {
          defaultValue: "User: {{name}} ({{email}}) updated successfully",
          name,
          email,
        })
      );
  
      // Let parent close dialog (don't call onClose here)
      onUpdated?.();
    },
  
    onError: (error: any) => {
      const fallbackName =
        [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
        t("users.unknown", { defaultValue: "User" });
  
      const fallbackEmail = user?.email ?? "";
  
      showError(
        error?.response?.data?.detail ||
          error?.message ||
          t("notifications.userUpdateError", {
            defaultValue: "Failed to update user: {{name}} ({{email}})",
            name: fallbackName,
            email: fallbackEmail,
          })
      );
    },
  });  

  const onSubmit = async (data: FormValues) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>
          {isEdit
            ? t("users.editTitle", { defaultValue: "Edit User" })
            : t("users.createTitle", { defaultValue: "Create User" })}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t("users.email", { defaultValue: "Email" })}
                  type="email"
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  disabled={isEdit}
                  fullWidth
                  required
                  onBlur={() => {
                    if (isSubmitted) {
                      trigger("email");
                    }
                  }}
                />
              )}
            />

            <Controller
              name="first_name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t("users.firstName", { defaultValue: "First Name" })}
                  error={!!errors.first_name}
                  helperText={errors.first_name?.message}
                  fullWidth
                  required
                  onBlur={() => {
                    if (isSubmitted) {
                      trigger("first_name");
                    }
                  }}
                />
              )}
            />

            <Controller
              name="last_name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t("users.lastName", { defaultValue: "Last Name" })}
                  error={!!errors.last_name}
                  helperText={errors.last_name?.message}
                  fullWidth
                  required
                  onBlur={() => {
                    if (isSubmitted) {
                      trigger("last_name");
                    }
                  }}
                />
              )}
            />

            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t("users.phone", { defaultValue: "Phone" })}
                  error={!!errors.phone}
                  helperText={errors.phone?.message}
                  fullWidth
                  required
                  onBlur={() => {
                    if (isSubmitted) {
                      trigger("phone");
                    }
                  }}
                />
              )}
            />

            <Controller
              name="department"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label={t("users.department", { defaultValue: "Department" })}
                  error={!!errors.department}
                  helperText={errors.department?.message}
                  fullWidth
                  required
                  disabled={loadingDepartments}
                >
                  {loadingDepartments ? (
                    <MenuItem disabled>
                      {t("common.loading", { defaultValue: "Loading departments..." })}
                    </MenuItem>
                  ) : departments && departments.length > 0 ? (
                    departments.map((dept: any) => (
                      <MenuItem key={dept.id} value={dept.name}>
                        {dept.name}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled>
                      {t("users.noDepartments", { defaultValue: "No departments available" })}
                    </MenuItem>
                  )}
                </TextField>
              )}
            />

            <Controller
              name="specialization"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t("users.specialization", { defaultValue: "Specialization" })}
                  error={!!errors.specialization}
                  helperText={errors.specialization?.message}
                  fullWidth
                />
              )}
            />

            <Controller
              name="roles"
              control={control}
              render={({ field }) => (
                <FormControl error={!!errors.roles} fullWidth>
                  <InputLabel id="roles-label" required>
                    {t("users.roles", { defaultValue: "Roles" })}
                  </InputLabel>
                  <Select
                    {...field}
                    labelId="roles-label"
                    multiple
                    disabled={isEditingHospitalAdmin}
                    input={<OutlinedInput label={t("users.roles", { defaultValue: "Roles" })} />}
                    renderValue={(selected) => (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 300,
                        },
                      },
                    }}
                  >
                    {loadingRoles ? (
                      <MenuItem disabled>
                        {t("common.loading", { defaultValue: "Loading roles..." })}
                      </MenuItem>
                    ) : roles && roles.length > 0 ? (
                      roles.map((role: string) => (
                        <MenuItem key={role} value={role}>
                          {role}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled>
                        {t("users.noRoles", { defaultValue: "No roles available" })}
                      </MenuItem>
                    )}
                  </Select>
                  {errors.roles && (
                    <FormHelperText>{errors.roles.message}</FormHelperText>
                  )}
                  {isEditingHospitalAdmin && (
                    <FormHelperText>
                      {t("users.cannotChangeHospitalAdminRole", { 
                        defaultValue: "Hospital Admin role cannot be changed." 
                      })}
                    </FormHelperText>
                  )}
                </FormControl>
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
          >
            {isSubmitting || createMutation.isPending || updateMutation.isPending
              ? t("common.saving", { defaultValue: "Saving..." })
              : isEdit
              ? t("common.save", { defaultValue: "Save" })
              : t("common.create", { defaultValue: "Create" })}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default UserFormDialog;
