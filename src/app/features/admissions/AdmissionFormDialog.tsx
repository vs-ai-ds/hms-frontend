// src/app/features/admissions/AdmissionFormDialog.tsx
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  Alert,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@app/lib/apiClient";
import { useAuthStore } from "@app/store/authStore";
import { useToast } from "@app/components/common/ToastProvider";
import { can } from "@app/lib/abac";
import Grid from "@mui/material/Grid";
import PatientMiniCard from "@app/components/patients/PatientMiniCard";
import {
  formatDateTimeLocal,
  parseDateTimeLocal,
  toUTCISOString,
} from "@app/lib/dateTimeUtils";

const admissionSchema = z.object({
  patient_id: z.string().uuid("Patient is required"),
  department_id: z.string()
    .optional() // Optional - backend will set it for doctors
    .refine(
      (val) => {
        // If provided, must be valid UUID
        if (!val || val.trim() === "") return true; // Empty is OK (backend will set it)
        try {
          z.string().uuid().parse(val);
          return true;
        } catch {
          return false;
        }
      },
      "Invalid department ID"
    ),
  primary_doctor_user_id: z.string()
    .optional() // Optional - backend will set it for doctors
    .refine(
      (val) => {
        // If provided, must be valid UUID
        if (!val || val.trim() === "") return true; // Empty is OK (backend will set it)
        try {
          z.string().uuid().parse(val);
          return true;
        } catch {
          return false;
        }
      },
      "Invalid doctor ID"
    ),
  admit_datetime: z.string().refine(
    (val) => {
      try {
        const date = new Date(val);
        return !isNaN(date.getTime());
      } catch {
        return false;
      }
    },
    "Invalid date and time"
  ),
  notes: z.string().max(1000, "Notes must be at most 1000 characters").optional().nullable(),
});

type AdmissionFormValues = z.infer<typeof admissionSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialPatientId?: string;
}

const AdmissionFormDialog: React.FC<Props> = ({
  open,
  onClose,
  onCreated,
  initialPatientId,
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const { user } = useAuthStore();
  
  // Check if current user is a doctor
  const isDoctor = user?.roles?.some((r: any) => r.name === "DOCTOR") || false;
  
  // Calculate default admission time: current time (no 15-minute restriction for IPD)
  // Returns in local timezone format (YYYY-MM-DDTHH:mm) for datetime-local input
  const getDefaultAdmitTime = () => {
    // Use current time - no rounding needed for IPD admissions
    const now = new Date();
    return formatDateTimeLocal(now);
  };

  const getInitialDoctorId = React.useMemo(() => {
    if (isDoctor && user?.id) {
      return user.id;
    }
    return "";
  }, [isDoctor, user?.id]);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<AdmissionFormValues>({
    resolver: zodResolver(admissionSchema),
    mode: "onChange", // Validate on change to catch errors early
    defaultValues: {
      patient_id: initialPatientId || "",
      department_id: "", // Will be set in useEffect
      primary_doctor_user_id: getInitialDoctorId,
      notes: null,
      admit_datetime: getDefaultAdmitTime(),
    },
  });

  // Reset form when initialPatientId changes
  React.useEffect(() => {
    if (initialPatientId) {
      reset({
        patient_id: initialPatientId,
        department_id: "", // Will be set in the auto-select useEffect
        primary_doctor_user_id: getInitialDoctorId,
        notes: null,
        admit_datetime: getDefaultAdmitTime(),
      });
    }
  }, [initialPatientId, reset, getInitialDoctorId]);

  // Fetch patients list for dropdown
  // Backend returns paginated response: { items: [...], total: ..., page: ..., page_size: ... }
  const { data: patientsResponse } = useQuery({
    queryKey: ["patients"],
    queryFn: async () => (await apiClient.get("/patients")).data,
  });
  const patients = patientsResponse?.items || [];

  // Check if user has permission to view users
  const canViewUsers = user ? can(user, "users:view") : false;
  
  // Fetch doctors list (users with DOCTOR role, only active)
  // Only fetch if user has permission (doctors don't need this, they use their own ID)
  const { data: doctors } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await apiClient.get("/users");
      return res.data.filter((u: any) => 
        u.roles?.some((r: any) => r.name === "DOCTOR") && u.is_active !== false
      );
    },
    enabled: open && canViewUsers && !isDoctor,
  });

  // Check if user has permission to view departments
  const canViewDepartments = user ? can(user, "departments:view") : false;
  
  // Fetch departments - only if user has permission (doctors don't need this, backend handles it)
  const { data: departments } = useQuery({
    queryKey: ["departments", "for_patients"],
    queryFn: async () => {
      const res = await apiClient.get("/departments", {
        params: { for_patients: true },
      });
      return res.data;
    },
    enabled: open && canViewDepartments && !isDoctor, // Doctors don't need this
  });

  // For doctors, backend will auto-set department_id and primary_doctor_user_id
  // No need to set values here - just let them be empty

  // Check for active admission before allowing new admission
  useQuery({
    queryKey: ["patient", initialPatientId],
    queryFn: async () => {
      if (!initialPatientId) return null;
      const res = await apiClient.get(`/patients/${initialPatientId}`);
      return res.data;
    },
    enabled: !!initialPatientId && open,
  });

  // Check for active admissions
  const { data: activeAdmissions } = useQuery({
    queryKey: ["admissions", "active", initialPatientId],
    queryFn: async () => {
      if (!initialPatientId) return [];
      try {
        const res = await apiClient.get("/admissions", {
          params: { patient_id: initialPatientId, status: "ACTIVE" },
        });
        return res.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!initialPatientId && open,
  });

  const hasActiveAdmission = activeAdmissions && activeAdmissions.length > 0;

  const onSubmit = async (values: AdmissionFormValues) => {
    try {
      // Check for active admission
      if (hasActiveAdmission) {
        showError(
          t("admissions.activeAdmissionExists", {
            defaultValue: "Patient is already admitted. Please discharge the current admission first.",
          })
        );
        return;
      }

      // For doctors, backend will auto-set department_id and primary_doctor_user_id
      // So we can send empty strings and let backend handle it

      // Convert datetime-local format to ISO string (UTC)
      // datetime-local gives us local time, we need to convert to UTC ISO string
      let admitDatetime = values.admit_datetime;
      if (admitDatetime) {
        if (!admitDatetime.includes('T')) {
          admitDatetime = `${admitDatetime}T00:00:00`;
        }
        // Parse local time string to Date object
        const localDate = parseDateTimeLocal(admitDatetime);
        if (isNaN(localDate.getTime())) {
          showError(t("admissions.invalidDateTime", { defaultValue: "Invalid date and time" }));
          return;
        }
        // No 15-minute interval restriction for IPD admissions - allow any minute selection
        // Convert to ISO string (UTC) - this is what the backend expects
        admitDatetime = toUTCISOString(localDate);
      }
      
      const payload = {
        patient_id: values.patient_id,
        department_id: values.department_id || undefined, // Backend will auto-set for doctors if empty
        primary_doctor_user_id: values.primary_doctor_user_id || undefined, // Backend will auto-set for doctors if empty
        admit_datetime: admitDatetime,
        notes: values.notes || null,
      };

      const createdAdmission = await apiClient.post("/admissions", payload);
      reset();
      
      // Extract admission details for success message
      const patientName = createdAdmission?.data?.patient_name || "Patient";
      const departmentName = createdAdmission?.data?.department || departments?.find((d: any) => d.id === values.department_id)?.name || "Department";
      const admitDateTime = createdAdmission?.data?.admit_datetime
        ? new Date(createdAdmission.data.admit_datetime).toLocaleString()
        : "";
      
      // Show success toast (single source of truth - child dialog shows toast)
      showSuccess(
        t("admissions.createSuccessDetailed", {
          defaultValue: "Patient {{name}} admitted successfully to {{department}} on {{date}}.",
          name: patientName,
          department: departmentName,
          date: admitDateTime,
        })
      );
      
      // Let parent close dialog and refresh data (don't call onClose here)
      onCreated();
    } catch (error: any) {
      const errorDetail = error?.response?.data?.detail || "";
      if (errorDetail.includes("active admission") || errorDetail.includes("already admitted")) {
        showError(
          t("admissions.activeAdmissionExists", {
            defaultValue: "Patient is already admitted. Please discharge the current admission first.",
          })
        );
      } else {
        showError(
          errorDetail || 
          t("admissions.createError", { defaultValue: "Failed to admit patient" })
        );
      }
    }
  };

  const selectedPatientId = watch("patient_id");

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t("admissions.admitPatient", { defaultValue: "Admit Patient (IPD)" })}</DialogTitle>
      <DialogContent sx={{ maxHeight: "80vh", overflowY: "auto" }}>
        {/* Show patient summary card when patient is selected */}
        {selectedPatientId && (
          <PatientMiniCard patientId={selectedPatientId} showWarning={true} />
        )}
        {hasActiveAdmission && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t("admissions.activeAdmissionWarning", {
              defaultValue: "Patient already has an active admission. Please discharge it before creating a new one.",
            })}
          </Alert>
        )}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {/* Only show patient select if initialPatientId is not provided */}
          {!initialPatientId && (
            <Grid size={{ xs: 12 }}>
              <Controller
                name="patient_id"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    options={patients || []}
                    getOptionLabel={(option: any) => 
                      `${option.first_name} ${option.last_name || ""} ${option.patient_code ? `(${option.patient_code})` : ""}`.trim()
                    }
                    value={patients?.find((p: any) => p.id === field.value) || null}
                    onChange={(_, value) => field.onChange(value?.id || "")}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={t("admissions.patient", { defaultValue: "Patient" })}
                        error={!!errors.patient_id}
                        helperText={errors.patient_id?.message}
                        required
                      />
                    )}
                  />
                )}
              />
            </Grid>
          )}

          {!isDoctor && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="department_id"
                control={control}
                rules={{
                  required: !isDoctor ? t("admissions.departmentRequired", { defaultValue: "Department is required" }) : false,
                }}
                render={({ field }) => (
                  <Autocomplete
                    options={departments || []}
                    getOptionLabel={(option: any) => option.name}
                    value={departments?.find((d: any) => d.id === field.value) || null}
                    onChange={(_, value) => {
                      field.onChange(value?.id || "");
                      // Clear doctor selection when department changes
                      setValue("primary_doctor_user_id", "");
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={t("admissions.department", { defaultValue: "Department" })}
                        required
                        error={!!errors.department_id}
                        helperText={errors.department_id?.message}
                      />
                    )}
                  />
                )}
              />
            </Grid>
          )}

          {!isDoctor && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="primary_doctor_user_id"
                control={control}
                rules={{
                  required: !isDoctor ? t("admissions.doctorRequired", { defaultValue: "Primary doctor is required" }) : false,
                }}
                render={({ field }) => {
                  // Filter doctors by selected department
                  const selectedDepartmentId = watch("department_id");
                  let filteredDoctors = doctors || [];
                  if (selectedDepartmentId && departments) {
                    const selectedDept = departments.find((d: any) => d.id === selectedDepartmentId);
                    if (selectedDept) {
                      filteredDoctors = filteredDoctors.filter((u: any) => {
                        if (u.department_id === selectedDepartmentId) return true;
                        if (u.department === selectedDept.name) return true;
                        return false;
                      });
                    }
                  }
                  
                  return (
                    <Autocomplete
                      options={filteredDoctors}
                      getOptionLabel={(option: any) => 
                        `${option.first_name} ${option.last_name}`.trim()
                      }
                      value={filteredDoctors.find((d: any) => d.id === field.value) || null}
                      onChange={(_, value) => field.onChange(value?.id || "")}
                      disabled={!filteredDoctors || filteredDoctors.length === 0 || !selectedDepartmentId}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={t("admissions.primaryDoctor", { defaultValue: "Primary Doctor" })}
                          error={!!errors.primary_doctor_user_id}
                          helperText={
                            errors.primary_doctor_user_id?.message ||
                            (selectedDepartmentId && (!filteredDoctors || filteredDoctors.length === 0)
                              ? t("admissions.noDoctorsInDepartment", { defaultValue: "No doctors found in selected department" })
                              : !selectedDepartmentId
                              ? t("admissions.selectDepartmentFirst", { defaultValue: "Please select a department first" })
                              : undefined)
                          }
                          required
                        />
                      )}
                    />
                  );
                }}
              />
            </Grid>
          )}

          <Grid size={{ xs: 12 }}>
            <TextField
              type="datetime-local"
              label={t("admissions.admitDatetime", { defaultValue: "Admission Date & Time" })}
              fullWidth
              {...register("admit_datetime")}
              error={!!errors.admit_datetime}
              helperText={errors.admit_datetime?.message}
              InputLabelProps={{ shrink: true }}
              required
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField
              label={t("admissions.notes", { defaultValue: "Notes (Optional)" })}
              fullWidth
              multiline
              rows={3}
              {...register("notes")}
              error={!!errors.notes}
              helperText={errors.notes?.message}
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ pr: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isSubmitting}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button 
          onClick={handleSubmit(onSubmit, (errors) => {
            // Log validation errors for debugging - show in console and alert
            console.error("Form validation errors:", errors);
            // Show detailed error messages
            const errorMessages = Object.entries(errors).map(([field, error]: [string, any]) => {
              return `${field}: ${error?.message || "Invalid value"}`;
            }).join("\n");
            console.error("Detailed errors:\n" + errorMessages);
            alert("Form validation errors:\n\n" + errorMessages + "\n\nCheck browser console (F12) for more details.");
            showError(t("admissions.validationError", { defaultValue: "Please fix form errors before submitting. Check console (F12) for details." }));
          })} 
          variant="contained" 
          disabled={isSubmitting || hasActiveAdmission}
        >
          {t("admissions.admit", { defaultValue: "Admit Patient" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AdmissionFormDialog;
