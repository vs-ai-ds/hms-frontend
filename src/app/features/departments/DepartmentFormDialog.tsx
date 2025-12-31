// src/app/features/departments/DepartmentFormDialog.tsx
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  FormControlLabel,
  Checkbox,
  Typography,
  Divider,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@app/lib/apiClient";
import { useTranslation } from "react-i18next";
import { useToast } from "@app/components/common/ToastProvider";

const schema = z.object({
  name: z
    .string()
    .min(1, "Department name is required")
    .transform((val) => val.trim()) // Trim whitespace
    .pipe(
      z
        .string()
        .min(2, "Department name must be at least 2 characters")
        .max(100, "Department name must be at most 100 characters")
        .regex(
          /^[A-Za-z0-9\s\-:_.,()]+$/,
          "Department name can only contain alphanumeric characters, spaces, dash (-), colon (:), underscore (_), comma, period, and parentheses."
        )
    ),
  description: z.string().optional().transform((val) => (val ? val.trim() : undefined)),
  is_for_staff: z.boolean().default(true),
  is_for_patients: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

interface Department {
  id: string;
  name: string;
  description?: string | null;
  is_for_staff?: boolean;
  is_for_patients?: boolean;
}

interface DepartmentFormDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  department?: Department | null;
}

const DepartmentFormDialog: React.FC<DepartmentFormDialogProps> = ({
  open,
  onClose,
  onCreated,
  onUpdated,
  department,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const isEdit = !!department;

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: department
      ? {
          name: department.name,
          description: department.description || "",
          is_for_staff: department.is_for_staff ?? true,
          is_for_patients: department.is_for_patients ?? true,
        }
      : {
          name: "",
          description: "",
          is_for_staff: true,
          is_for_patients: true,
        },
  });

  React.useEffect(() => {
    if (department) {
      reset({
        name: department.name,
        description: department.description || "",
        is_for_staff: department.is_for_staff ?? true,
        is_for_patients: department.is_for_patients ?? true,
      });
    } else {
      reset({
        name: "",
        description: "",
        is_for_staff: true,
        is_for_patients: true,
      });
    }
  }, [department, reset]);

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      await apiClient.post("/departments", data);
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      showSuccess(t("notifications.departmentCreated", { defaultValue: "Department: {{name}} created successfully.", name: data.name }));
      reset();
      onCreated?.();
    },
    onError: (error: any, data) => {
      showError(
        error?.response?.data?.detail ||
        t("notifications.departmentCreateError", { defaultValue: "Failed to create department: {{name}}.", name: data.name })
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      await apiClient.patch(`/departments/${department!.id}`, data);
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      showSuccess(t("notifications.departmentUpdated", { defaultValue: "Department: {{name}} updated successfully.", name: data.name }));
      reset();
      onUpdated?.();
    },
    onError: (error: any, data) => {
      showError(
        error?.response?.data?.detail ||
        t("notifications.departmentUpdateError", { defaultValue: "Failed to update department: {{name}}.", name: data.name })
      );
    },
  });

  const onSubmit = async (data: FormValues) => {
    // Ensure name is trimmed before submission
    const trimmedData = {
      ...data,
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
    };
    if (isEdit) {
      updateMutation.mutate(trimmedData);
    } else {
      createMutation.mutate(trimmedData);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>
          {isEdit
            ? t("departments.editTitle", { defaultValue: "Edit Department" })
            : t("departments.createTitle", { defaultValue: "Create Department" })}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t("departments.name", { defaultValue: "Department Name" })}
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  fullWidth
                  required
                />
              )}
            />

            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t("departments.description", { defaultValue: "Description" })}
                  error={!!errors.description}
                  helperText={errors.description?.message}
                  fullWidth
                  multiline
                  rows={3}
                />
              )}
            />

            <Divider sx={{ my: 1 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t("departments.availability", { defaultValue: "Department Availability" })}
            </Typography>

            <Controller
              name="is_for_staff"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  }
                  label={t("departments.forStaff", { defaultValue: "Available for Staff/Users" })}
                />
              )}
            />

            <Controller
              name="is_for_patients"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  }
                  label={t("departments.forPatients", { defaultValue: "Available for Patients" })}
                />
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

export default DepartmentFormDialog;

