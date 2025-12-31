// src/app/features/patients/PatientFormDialog.tsx
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  patientSchema,
  type PatientFormValues,
} from "@app/lib/validation/patientValidation";
import { apiClient } from "@app/lib/apiClient";
import { useToast } from "@app/components/common/ToastProvider";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@app/store/authStore";
import { can } from "@app/lib/abac";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const PatientFormDialog: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    trigger,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    mode: "onBlur", // Validate on blur
    defaultValues: {
      patient_type: "OPD",
    },
  });

  const user = useAuthStore((s) => s.user);
  
  // Check permissions
  const canViewDepartments = user ? can(user, "departments:view") : false;

  // Fetch departments for dropdown - only if user has permission
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await apiClient.get("/departments");
      return res.data;
    },
    enabled: open && canViewDepartments,
  });

  const onSubmit = async (values: PatientFormValues) => {
    try {
      const payload = {
        ...values,
        first_name: values.first_name.trim(),
        last_name: values.last_name?.trim() || null,
        phone: values.phone?.trim() || null,
        email: values.email?.trim() || null,
        department: values.department.trim(),
      };

      const createdPatient = await apiClient.post("/patients", payload);
      reset();
      
      // Extract patient details for success message
      const patientName = createdPatient?.data?.first_name 
        ? `${createdPatient.data.first_name} ${createdPatient.data.last_name || ""}`.trim()
        : "Patient";
      const patientCode = createdPatient?.data?.patient_code || "";
      
      // Show success toast (single source of truth - child dialog shows toast)
      showSuccess(
        t("patients.createSuccessDetailed", {
          defaultValue: "Patient {{name}} ({{code}}) created successfully.",
          name: patientName,
          code: patientCode,
        })
      );
      
      // Let parent close dialog and refresh data (don't call onClose here)
      onCreated();
    } catch (error: any) {
      showError(
        error?.response?.data?.detail || 
        t("notifications.patientCreateError", { defaultValue: "Failed to create patient" })
      );
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Register Patient</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="First Name"
              fullWidth
              {...register("first_name", {
                onBlur: () => trigger("first_name"),
              })}
              error={!!errors.first_name}
              helperText={errors.first_name?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Last Name"
              fullWidth
              {...register("last_name", {
                onBlur: () => trigger("last_name"),
              })}
              error={!!errors.last_name}
              helperText={errors.last_name?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Phone"
              fullWidth
              {...register("phone", {
                onBlur: async () => {
                  await trigger("phone");
                  // Check for duplicates
                  const firstName = watch("first_name");
                  const lastName = watch("last_name");
                  const phoneValue = watch("phone");
                  if (firstName && phoneValue) {
                    try {
                      const normalizedPhone = phoneValue.replace(/[\s\-\(\)]/g, "").trim();
                      const duplicateCheck = await apiClient.get(
                        "/patients/check-duplicates",
                        {
                          params: {
                            first_name: firstName.trim(),
                            last_name: lastName?.trim() || null,
                            phone_primary: normalizedPhone,
                          },
                        }
                      );
                      if (duplicateCheck.data.has_duplicates) {
                        showError(
                          t("patients.duplicateFound", {
                            defaultValue: "A patient with this name and/or phone number already exists",
                          })
                        );
                      }
                    } catch (err) {
                      // Ignore duplicate check errors
                    }
                  }
                },
              })}
              error={!!errors.phone}
              helperText={errors.phone?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Email"
              fullWidth
              {...register("email")}
              error={!!errors.email}
              helperText={errors.email?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              select
              label="Department"
              fullWidth
              {...register("department")}
              error={!!errors.department}
              helperText={errors.department?.message}
              required
            >
              {departments?.map((dept: any) => (
                <MenuItem key={dept.id} value={dept.name}>
                  {dept.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              select
              label="Patient Type"
              fullWidth
              {...register("patient_type")}
              error={!!errors.patient_type}
              helperText={errors.patient_type?.message}
            >
              <MenuItem value="OPD">OPD</MenuItem>
              <MenuItem value="IPD">IPD</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ pr: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit(onSubmit)}
          variant="contained"
          disabled={isSubmitting}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PatientFormDialog;