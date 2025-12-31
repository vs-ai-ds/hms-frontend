// src/app/features/appointments/AppointmentFormDialog.tsx
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
import Grid from "@mui/material/Grid";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";

import {
  appointmentSchema,
  AppointmentFormValues,
} from "@app/lib/validation/appointmentValidation";
import { createAppointment } from "@app/lib/api/appointments";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@app/lib/apiClient";
import { useAuthStore } from "@app/store/authStore";
import { useToast } from "@app/components/common/ToastProvider";
import PatientMiniCard from "@app/components/patients/PatientMiniCard";
import { can } from "@app/lib/abac";
import {
  formatDateTimeLocal,
  getNext15MinuteSlot,
  getMinDateTimeLocal,
} from "@app/lib/dateTimeUtils";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialPatientId?: string;
}

const AppointmentFormDialog: React.FC<Props> = ({
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
  
  // Calculate default appointment time: next available 15-minute slot (for walk-in appointments)
  // Returns in local timezone format (YYYY-MM-DDTHH:mm) for datetime-local input
  const getDefaultAppointmentTime = () => {
    // Get next 15-minute slot (00, 15, 30, 45)
    const nextSlot = getNext15MinuteSlot(10); // Add 10 minutes buffer, then round to next 15
    return formatDateTimeLocal(nextSlot);
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
  } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    mode: "onChange", // Validate on change to catch errors early
    defaultValues: {
      patient_id: initialPatientId || "",
      department_id: "", // Will be set in useEffect
      doctor_user_id: getInitialDoctorId,
      scheduled_at: getDefaultAppointmentTime(),
      notes: null,
    },
  });

  // Reset form when initialPatientId changes
  React.useEffect(() => {
    if (initialPatientId) {
      reset({
        patient_id: initialPatientId,
        department_id: "", // Will be set in the auto-select useEffect
        doctor_user_id: getInitialDoctorId,
        scheduled_at: getDefaultAppointmentTime(),
        notes: null,
      });
    }
  }, [initialPatientId, reset, getInitialDoctorId]);

  // fetch patients list for dropdown
  // Handle paginated response: /patients returns { items: [...], total: ... }
  const { data: patientsData } = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const res = await apiClient.get("/patients");
      // Handle both paginated and non-paginated responses
      return res.data?.items || res.data || [];
    },
  });
  const patients = Array.isArray(patientsData) ? patientsData : [];

  // Check if user has permission to view departments and users
  const canViewDepartments = user ? can(user, "departments:view") : false;
  const canViewUsers = user ? can(user, "users:view") : false;
  
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

  // For doctors, backend will auto-set department_id and doctor_user_id
  // No need to set values here - just let them be empty

  // Watch department_id and patient_id
  const selectedDepartmentId = watch("department_id");
  const selectedPatientId = watch("patient_id");

  // Check for active admission if patient is selected
  const { data: activeAdmissions } = useQuery({
    queryKey: ["admissions", "active", selectedPatientId],
    queryFn: async () => {
      if (!selectedPatientId) return [];
      try {
        const res = await apiClient.get("/admissions", {
          params: { patient_id: selectedPatientId, status: "ACTIVE" },
        });
        return res.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!selectedPatientId && open,
  });

  const hasActiveAdmission = activeAdmissions && activeAdmissions.length > 0;

  // fetch doctors list (filtered by department if selected)
  const { data: doctors } = useQuery({
    queryKey: ["users", "doctors", selectedDepartmentId, isDoctor, user?.id],
    queryFn: async () => {
      const res = await apiClient.get("/users");
      let filtered = res.data.filter((u: any) => 
        u.roles?.some((r: any) => r.name === "DOCTOR") && u.is_active !== false
      );
      
      // Filter by department if selected
      if (selectedDepartmentId) {
        // Filter doctors who have this department in their department field or department_id
        filtered = filtered.filter((u: any) => {
          // Check if user's department matches the selected department
          if (u.department_id === selectedDepartmentId) return true;
          // Also check department name match (for backward compatibility)
          if (selectedDepartmentId && departments) {
            const selectedDept = departments.find((d: any) => d.id === selectedDepartmentId);
            if (selectedDept && u.department === selectedDept.name) return true;
          }
          return false;
        });
      }
      
      return filtered;
    },
    enabled: open && canViewUsers && !isDoctor,
  });

  const onSubmit = async (values: AppointmentFormValues) => {
    try {
      // 1) Block if patient has active admission
      if (hasActiveAdmission) {
        showError(
          t("appointments.activeAdmissionBlocked", {
            defaultValue:
              "Cannot create OPD appointment for patient with active admission. Please discharge the patient first.",
          })
        );
        return;
      }
  
      // 2) Normalize + validate scheduled_at
      // values.scheduled_at is expected to be a datetime-local string (YYYY-MM-DDTHH:mm) or a date-like string.
      let scheduledAtISO: string | null = null;
  
      if (values.scheduled_at) {
        let raw = values.scheduled_at.trim();
  
        // If it's a date-only string, default to 00:00 local time
        if (raw && !raw.includes("T")) {
          raw = `${raw}T00:00`;
        }
  
        const localDate = new Date(raw);
  
        if (Number.isNaN(localDate.getTime())) {
          showError(t("appointments.invalidDateTime", { defaultValue: "Invalid date and time" }));
          return;
        }
  
        // Allow up to 5 minutes in the past (walk-in buffer)
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  
        if (localDate < fiveMinutesAgo) {
          showError(
            t("appointments.pastTimeNotAllowed", {
              defaultValue: "Appointment time cannot be more than 5 minutes in the past",
            })
          );
          return;
        }
  
        scheduledAtISO = localDate.toISOString();
      }
  
      // 3) Payload (backend auto-sets dept/doctor for doctors)
      const payload = {
        patient_id: values.patient_id,
        department_id: values.department_id || undefined,
        scheduled_at: scheduledAtISO,
        doctor_user_id: values.doctor_user_id || undefined,
        notes: values.notes?.trim() ? values.notes.trim() : null,
      };
  
      const createdAppointment = await createAppointment(payload);
  
      // 4) Prepare success message
      const patientName = createdAppointment?.patient_name || t("common.patient", { defaultValue: "Patient" });
      const doctorName = createdAppointment?.doctor_name || t("common.doctor", { defaultValue: "Doctor" });
      const appointmentDateTime =
        createdAppointment?.scheduled_at ? new Date(createdAppointment.scheduled_at).toLocaleString() : "";

      // 5) Show toast (single source of truth)
      showSuccess(
        t("appointments.createSuccessDetailed", {
          defaultValue: "Appointment created successfully for {{name}} with {{doctor}} on {{date}}.",
          name: patientName,
          doctor: doctorName,
          date: appointmentDateTime || "",
        })
      );

      // 6) Reset form then let parent close + refresh
      reset();
      onCreated?.();
    } catch (error: any) {
      const errorDetailRaw = error?.response?.data?.detail;
  
      // FastAPI can send detail as string or array/object; normalize to a string
      const errorDetail =
        typeof errorDetailRaw === "string"
          ? errorDetailRaw
          : Array.isArray(errorDetailRaw)
            ? errorDetailRaw.map((e) => e?.msg || e?.message || String(e)).join(", ")
            : errorDetailRaw?.message || String(errorDetailRaw || "");
  
      // Doctor role validation
      if (
        errorDetail.toLowerCase().includes("does not have the doctor role") ||
        errorDetail.toLowerCase().includes("not a doctor")
      ) {
        showError(
          t("appointments.doctorRoleError", {
            defaultValue:
              errorDetail || "The selected user does not have the DOCTOR role. Please select a user with the DOCTOR role.",
          })
        );
        return;
      }
  
      // Duplicate appointment
      if (
        errorDetail.toLowerCase().includes("duplicate") ||
        errorDetail.toLowerCase().includes("already has an appointment")
      ) {
        showError(
          t("appointments.duplicateAppointment", {
            defaultValue: "Patient already has an appointment at this time. Please choose a different time.",
          })
        );
        return;
      }
  
      showError(
        errorDetail ||
          t("appointments.createError", { defaultValue: "Failed to create appointment" })
      );
    }
  };  

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("appointments.create", { defaultValue: "Create Appointment" })}</DialogTitle>
      <DialogContent>
        {selectedPatientId && (
          <PatientMiniCard patientId={selectedPatientId} showWarning={true} />
        )}
        {hasActiveAdmission && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t("appointments.activeAdmissionWarning", {
              defaultValue: "Patient has an active admission. Cannot create OPD appointment. Please discharge the patient first.",
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
                    value={patients.find((p: any) => p.id === field.value) || null}
                    onChange={(_, value) => field.onChange(value?.id || "")}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={t("appointments.patient", { defaultValue: "Patient" })}
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
                  required: !isDoctor ? t("appointments.departmentRequired", { defaultValue: "Please select a department" }) : false,
                  validate: (value) => {
                    if (isDoctor) return true; // Skip validation for doctors
                    if (!value || value.trim() === "") {
                      return t("appointments.departmentRequired", { defaultValue: "Please select a department" });
                    }
                    return true;
                  }
                }}
                render={({ field }) => (
                  <Autocomplete
                    options={departments || []}
                    getOptionLabel={(option: any) => option.name}
                    value={departments?.find((d: any) => d.id === field.value) || null}
                    onChange={(_, value) => {
                      field.onChange(value?.id || "");
                      // Clear doctor selection when department changes
                      setValue("doctor_user_id", "");
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={t("appointments.department", { defaultValue: "Department" })}
                        required
                        error={!!errors.department_id}
                        helperText={errors.department_id?.message || (errors.department_id ? t("appointments.departmentRequired", { defaultValue: "Please select a department" }) : undefined)}
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
                name="doctor_user_id"
                control={control}
                rules={{ 
                  required: !isDoctor ? t("appointments.doctorRequired", { defaultValue: "Please select a doctor" }) : false,
                  validate: (value) => {
                    if (isDoctor) return true; // Skip validation for doctors
                    if (!value || value.trim() === "") {
                      return t("appointments.doctorRequired", { defaultValue: "Please select a doctor" });
                    }
                    return true;
                  }
                }}
                render={({ field }) => (
                  <Autocomplete
                    options={doctors || []}
                    getOptionLabel={(option: any) => 
                      `${option.first_name} ${option.last_name}`.trim()
                    }
                    value={doctors?.find((d: any) => d.id === field.value) || null}
                    onChange={(_, value) => field.onChange(value?.id || "")}
                    disabled={!doctors || doctors.length === 0 || !selectedDepartmentId}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={t("appointments.doctor", { defaultValue: "Doctor" })}
                        error={!!errors.doctor_user_id}
                        helperText={
                          errors.doctor_user_id?.message ||
                          (selectedDepartmentId && (!doctors || doctors.length === 0)
                            ? t("appointments.noDoctorsInDepartment", { defaultValue: "No doctors found in selected department" })
                            : !selectedDepartmentId
                            ? t("appointments.selectDepartmentFirst", { defaultValue: "Please select a department first" })
                            : undefined)
                        }
                        required
                      />
                    )}
                  />
                )}
              />
            </Grid>
          )}

          <Grid size={{ xs: 12 }}>
            <TextField
              type="datetime-local"
              label={t("appointments.scheduledAt", { defaultValue: "Scheduled Date & Time" })}
              fullWidth
              {...register("scheduled_at")}
              error={!!errors.scheduled_at}
              helperText={errors.scheduled_at?.message || t("appointments.timeIntervalHint", { 
                defaultValue: "Time is booked in 15-minute steps (00, 15, 30, 45)." 
              })}
              InputLabelProps={{ shrink: true }}
              required
              inputProps={{
                min: getMinDateTimeLocal(),
                step: 900, // 15 minutes in seconds
              }}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField
              label={t("appointments.notes", { defaultValue: "Notes (Optional)" })}
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
            // Log validation errors for debugging
            console.log("Form validation errors:", errors);
            if (Object.keys(errors).length > 0) {
              showError(t("appointments.validationError", { defaultValue: "Please fix form errors before submitting" }));
            }
          })} 
          variant="contained" 
          disabled={isSubmitting || hasActiveAdmission}
        >
          {isSubmitting
            ? t("appointments.creating", { defaultValue: "Creating..." })
            : t("appointments.create", { defaultValue: "Create Appointment" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AppointmentFormDialog;