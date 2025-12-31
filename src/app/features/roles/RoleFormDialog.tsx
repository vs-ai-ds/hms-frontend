// src/app/features/roles/RoleFormDialog.tsx
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
  Checkbox,
  ListItemText,
  CircularProgress,
  Typography,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@app/lib/apiClient";
import { useTranslation } from "react-i18next";
import { useToast } from "@app/components/common/ToastProvider";

const schema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional(),
  permission_codes: z.array(z.string()).min(1, "At least one permission is required"),
  template_role_id: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

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
  permissions: Permission[];
}

interface RoleFormDialogProps {
  open: boolean;
  onClose: () => void;
  role?: Role | null;
}

const RoleFormDialog: React.FC<RoleFormDialogProps> = ({
  open,
  onClose,
  role,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const isEdit = !!role;

  // Fetch available permissions
  const { data: availablePermissions, isLoading: loadingPermissions } = useQuery<Permission[]>({
    queryKey: ["roles", "permissions"],
    queryFn: async () => {
      const res = await apiClient.get("/roles/permissions");
      // Ensure we return an array
      if (Array.isArray(res.data)) {
        return res.data;
      }
      return [];
    },
    enabled: open,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: role
      ? {
          name: role.name,
          description: role.description || "",
          permission_codes: role.permissions.map((p) => p.code),
        }
      : {
          name: "",
          description: "",
          permission_codes: [],
        },
  });

  React.useEffect(() => {
    if (role) {
      reset({
        name: role.name,
        description: role.description || "",
        permission_codes: role.permissions.map((p) => p.code),
      });
    } else {
      reset({
        name: "",
        description: "",
        permission_codes: [],
      });
    }
  }, [role, reset]);

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      await apiClient.post("/roles", data);
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      showSuccess(t("notifications.roleCreated", { 
        defaultValue: `Role: {{name}} created successfully.`,
        name: data.name,
      }));
      onClose();
    },
    onError: (error: any, data) => {
      showError(
        error?.response?.data?.detail ||
        t("notifications.roleCreateError", { 
          defaultValue: `Failed to create role "${data.name}".` 
        })
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      await apiClient.patch(`/roles/${role!.id}`, data);
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      showSuccess(t("notifications.roleUpdated", { 
        defaultValue: `Role: {{name}} updated successfully.`,
        name: data.name,
      }));
      onClose();
    },
    onError: (error: any, data) => {
      showError(
        error?.response?.data?.detail ||
        t("notifications.roleUpdateError", { 
          defaultValue: `Failed to update role "${data.name}".` 
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

  // Group permissions by category with proper capitalization
  const permissionsByCategory = React.useMemo(() => {
    if (!availablePermissions) return {};
    const grouped: Record<string, Permission[]> = {};
    availablePermissions.forEach((perm) => {
      const category = perm.category || "Other";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(perm);
    });
    return grouped;
  }, [availablePermissions]);

  // Capitalize category names
  const capitalizeCategory = (category: string): string => {
    return category
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  // Handle parent category selection/deselection
  const handleCategoryToggle = (category: string, field: any) => {
    const categoryPerms = permissionsByCategory[category] || [];
    const categoryCodes = categoryPerms.map(p => p.code);
    const allSelected = categoryCodes.every(code => field.value.includes(code));
    
    if (allSelected) {
      // Deselect all in category
      field.onChange(field.value.filter((code: string) => !categoryCodes.includes(code)));
    } else {
      // Select all in category
      const newValues = [...new Set([...field.value, ...categoryCodes])];
      field.onChange(newValues);
    }
  };

  // Check if all permissions in a category are selected
  const isCategoryFullySelected = (category: string, selectedCodes: string[]): boolean => {
    const categoryPerms = permissionsByCategory[category] || [];
    if (categoryPerms.length === 0) return false;
    return categoryPerms.every(perm => selectedCodes.includes(perm.code));
  };

  // Check if some (but not all) permissions in a category are selected
  const isCategoryPartiallySelected = (category: string, selectedCodes: string[]): boolean => {
    const categoryPerms = permissionsByCategory[category] || [];
    if (categoryPerms.length === 0) return false;
    const selectedCount = categoryPerms.filter(perm => selectedCodes.includes(perm.code)).length;
    return selectedCount > 0 && selectedCount < categoryPerms.length;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>
          {isEdit
            ? t("roles.editTitle", { defaultValue: "Edit Role" })
            : t("roles.createTitle", { defaultValue: "Create Role" })}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t("roles.name", { defaultValue: "Role Name" })}
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  fullWidth
                  required
                  disabled={isEdit && role?.is_system}
                />
              )}
            />

            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t("roles.description", { defaultValue: "Description" })}
                  error={!!errors.description}
                  helperText={errors.description?.message}
                  fullWidth
                  multiline
                  rows={2}
                />
              )}
            />

            <Controller
              name="permission_codes"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.permission_codes}>
                  <InputLabel id="permissions-label" required>
                    {t("roles.permissions", { defaultValue: "Permissions" })}
                  </InputLabel>
                  <Select
                    {...field}
                    labelId="permissions-label"
                    multiple
                    input={<OutlinedInput label={t("roles.permissions", { defaultValue: "Permissions" })} />}
                    renderValue={(selected) => (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {selected.map((value) => {
                          const perm = availablePermissions?.find((p) => p.code === value);
                          return (
                            <Chip key={value} label={perm?.code || value} size="small" />
                          );
                        })}
                      </Box>
                    )}
                    disabled={loadingPermissions || (isEdit && role?.is_system)}
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 400,
                        },
                        sx: {
                          maxHeight: 400,
                        },
                      },
                      anchorOrigin: {
                        vertical: "bottom",
                        horizontal: "left",
                      },
                      transformOrigin: {
                        vertical: "top",
                        horizontal: "left",
                      },
                    }}
                  >
                    {loadingPermissions ? (
                      <MenuItem disabled>
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                        {t("common.loading", { defaultValue: "Loading..." })}
                      </MenuItem>
                    ) : (
                      Object.entries(permissionsByCategory).flatMap(([category, perms]) => {
                        const isFullySelected = isCategoryFullySelected(category, field.value);
                        const isPartiallySelected = isCategoryPartiallySelected(category, field.value);
                        
                        return [
                          <MenuItem 
                            key={`header-${category}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleCategoryToggle(category, field);
                            }}
                            sx={{ 
                              backgroundColor: isFullySelected ? 'action.selected' : isPartiallySelected ? 'action.hover' : 'transparent',
                              '&:hover': { backgroundColor: 'action.hover' },
                              cursor: 'pointer',
                              borderBottom: '1px solid',
                              borderColor: 'divider',
                              pointerEvents: 'auto'
                            }}
                          >
                            <Checkbox 
                              checked={isFullySelected}
                              indeterminate={isPartiallySelected}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCategoryToggle(category, field);
                              }}
                              onChange={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCategoryToggle(category, field);
                              }}
                            />
                            <Typography variant="subtitle2" fontWeight={600}>
                              {capitalizeCategory(category)}
                            </Typography>
                          </MenuItem>,
                          ...perms.map((perm) => (
                            <MenuItem 
                              key={perm.code} 
                              value={perm.code}
                              onMouseDown={(e) => {
                                e.preventDefault();
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const newValue = field.value.includes(perm.code)
                                  ? field.value.filter((v: string) => v !== perm.code)
                                  : [...field.value, perm.code];
                                field.onChange(newValue);
                              }}
                              sx={{ pl: 4 }}
                            >
                              <Checkbox 
                                checked={field.value.includes(perm.code)}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const newValue = field.value.includes(perm.code)
                                    ? field.value.filter((v: string) => v !== perm.code)
                                    : [...field.value, perm.code];
                                  field.onChange(newValue);
                                }}
                                onChange={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const newValue = e.target.checked
                                    ? [...field.value, perm.code]
                                    : field.value.filter((v: string) => v !== perm.code);
                                  field.onChange(newValue);
                                }}
                              />
                              <ListItemText
                                primary={perm.code}
                                secondary={perm.name}
                              />
                            </MenuItem>
                          )),
                        ];
                      })
                    )}
                  </Select>
                  {errors.permission_codes && (
                    <FormHelperText>{errors.permission_codes?.message}</FormHelperText>
                  )}
                </FormControl>
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || createMutation.isPending || updateMutation.isPending || (isEdit && role?.is_system)}
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

export default RoleFormDialog;

