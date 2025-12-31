// src/app/features/prescriptions/IssuePrescriptionDialog.tsx
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  MenuItem,
  Alert,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@app/lib/apiClient";
import { useAuthStore } from "@app/store/authStore";
import { can } from "@app/lib/abac";
import { useToast } from "@app/components/common/ToastProvider";
import { updatePrescriptionStatus } from "@app/lib/api/prescriptions";
import {
  parseDateTimeLocal,
  toUTCISOString,
  getMinDateTimeLocal,
} from "@app/lib/dateTimeUtils";

/**
 * NOTE:
 * We build schema with role-awareness.
 * - Doctor flow: department/doctor are auto-assigned (fields hidden), so only date/time should be validated.
 * - Non-doctor flow: department + doctor are required because user selects them.
 */
const buildIssueSchema = (opts: { isDoctor: boolean }) =>
  z
    .object({
      create_followup: z.boolean().optional(),
      followup_scheduled_at: z.string().optional(),
      followup_department_id: z.string().optional(),
      followup_doctor_id: z.string().optional(),
    })
    .refine(
      (data) => {
        if (!data.create_followup) return true;

        const raw = (data.followup_scheduled_at ?? "").trim();
        if (!raw) return false;

        // datetime-local value should parse cleanly (browser gives "YYYY-MM-DDTHH:mm")
        const dt = new Date(raw);
        if (Number.isNaN(dt.getTime())) return false;

        // Small grace to avoid annoying "past" errors when user submits right at current minute.
        const now = new Date();
        now.setMinutes(now.getMinutes() - 1);
        if (dt.getTime() < now.getTime()) return false;

        // Validate 15-minute interval (00, 15, 30, 45)
        const minutes = dt.getMinutes();
        return minutes % 15 === 0;
      },
      {
        message: "Please select a valid follow-up date & time (cannot be in the past) in 15-minute steps (e.g., 08:00, 08:15, 08:30, 08:45).",
        path: ["followup_scheduled_at"],
      }
    )
    .refine(
      (data) => {
        if (!data.create_followup) return true;

        // Doctor does not choose department (hidden), it is auto assigned.
        if (opts.isDoctor) return true;

        const v = (data.followup_department_id ?? "").trim();
        if (!v) return false;

        return z.string().uuid().safeParse(v).success;
      },
      {
        message: "Please select a department.",
        path: ["followup_department_id"],
      }
    )
    .refine(
      (data) => {
        if (!data.create_followup) return true;

        // Doctor does not choose doctor (hidden), it is auto assigned to self.
        if (opts.isDoctor) return true;

        const v = (data.followup_doctor_id ?? "").trim();
        if (!v) return false;

        return z.string().uuid().safeParse(v).success;
      },
      {
        message: "Please select a doctor.",
        path: ["followup_doctor_id"],
      }
    );

interface IssuePrescriptionDialogProps {
  open: boolean;
  onClose: () => void;
  onIssue: (followupData?: {
    create_followup: boolean;
    followup_scheduled_at?: string;
    followup_department_id?: string;
    followup_doctor_id?: string;
  }) => void;
  prescription: any; // Prescription object
}

const IssuePrescriptionDialog: React.FC<IssuePrescriptionDialogProps> = ({
  open,
  onClose,
  onIssue,
  prescription,
}) => {
  const { t } = useTranslation();
  const { showError, showSuccess } = useToast();

  const user = useAuthStore((s) => s.user);
  const userRoles = user?.roles?.map((r: any) => r.name) || [];
  const isDoctor = userRoles.includes("DOCTOR");

  // Build schema once per role state (prevents stale validation rules).
  const issueSchema = React.useMemo(() => buildIssueSchema({ isDoctor }), [isDoctor]);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      create_followup: false,
      followup_scheduled_at: "",
      followup_department_id: "",
      followup_doctor_id: "",
    },
    // This gives a nicer UX: errors show on submit / blur rather than instantly yelling.
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const createFollowup = watch("create_followup");

  // Check permissions
  const canViewDepartments = user ? can(user, "departments:view") : false;
  const canViewUsers = user ? can(user, "users:view") : false;

  // Fetch departments - only if user has permission
  const { data: departments } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["departments"],
    queryFn: async () => (await apiClient.get("/departments")).data,
    enabled: open && canViewDepartments,
  });

  // Fetch appointment if prescription has appointment_id
  const { data: appointment } = useQuery({
    queryKey: ["appointment", prescription?.appointment_id],
    queryFn: async () => {
      if (!prescription?.appointment_id) return null;
      const res = await apiClient.get(`/appointments/${prescription.appointment_id}`);
      return res.data;
    },
    enabled: !!prescription?.appointment_id && open,
  });

  // Selected department (used for doctor filtering)
  const selectedDepartmentId = watch("followup_department_id");
  const selectedDepartment = departments?.find((d: any) => d.id === selectedDepartmentId);

  // Fetch doctors for selected department - only if user has permission
  const { data: doctors } = useQuery<Array<{ id: string; department?: string }>>({
    queryKey: ["users", "doctors", selectedDepartmentId],
    queryFn: async () => {
      const res = await apiClient.get("/users");
      const allDoctors = res.data.filter((u: any) => u.roles?.some((r: any) => r.name === "DOCTOR"));

      // Filter by department if selected - User.department is a string (department name)
      if (selectedDepartmentId && selectedDepartmentId.trim() !== "" && selectedDepartment) {
        const departmentName = selectedDepartment.name;
        return allDoctors.filter((d: any) => d.department === departmentName);
      }

      return allDoctors;
    },
    enabled:
      open &&
      canViewUsers &&
      !!selectedDepartmentId &&
      selectedDepartmentId.trim() !== "" &&
      !!selectedDepartment,
  });

  // Get default date/time (7 days from now, rounded to next 15-minute slot)
  const getDefaultDateTime = React.useCallback(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    // Round to next 15-minute interval
    const minutes = date.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    if (roundedMinutes >= 60) {
      date.setHours(date.getHours() + 1);
      date.setMinutes(0);
    } else {
      date.setMinutes(roundedMinutes);
    }
    date.setSeconds(0);
    date.setMilliseconds(0);
    // Format as datetime-local string
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutesStr = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutesStr}`;
  }, []);

  React.useEffect(() => {
    if (open && prescription) {
      // Pre-fill dept/doctor based on role and context.
      // For doctors: set to self (hidden in UI but used for backend payload).
      // For non-doctors: use appointment/prescription if available.
      let defaultDepartmentId = "";
      let defaultDoctorId = "";

      if (isDoctor && user) {
        // For doctor users, use their own department and ID
        if (user.department) {
          // Find department by name if it's a string, or use ID if it's an object
          if (typeof user.department === "string" && departments) {
            const userDept = departments.find((d: any) => d.name === user.department);
            if (userDept) defaultDepartmentId = userDept.id;
          } else if (typeof user.department === "object" && user.department.id) {
            defaultDepartmentId = user.department.id;
          }
        }
        if (user.id) defaultDoctorId = user.id;
      } else {
        defaultDepartmentId = appointment?.department_id || appointment?.department?.id || "";
        defaultDoctorId = prescription.doctor_user_id || "";
      }

      reset({
        create_followup: false,
        followup_scheduled_at: "",
        followup_department_id: defaultDepartmentId,
        followup_doctor_id: defaultDoctorId,
      });
    }
  }, [open, prescription, appointment, reset, isDoctor, user, departments]);

  React.useEffect(() => {
    if (!createFollowup) return;

    // When follow-up is enabled, we gently populate a sensible default date/time.
    // IMPORTANT: don't force validation here; validation should happen on submit / normal user interactions.
    const current = (watch("followup_scheduled_at") ?? "").trim();
    if (!current) {
      setValue("followup_scheduled_at", getDefaultDateTime(), { shouldValidate: false, shouldDirty: true });
    }
  }, [createFollowup, watch, setValue, getDefaultDateTime]);

  const onSubmit = async (values: any) => {
    if (isSubmitting) return;
    
    if (values.create_followup) {
      let departmentId = values.followup_department_id;
      let doctorId = values.followup_doctor_id;

      // Just a safety net: in doctor flow, ensure we always send dept/doctor.
      // UI is hidden, but backend still wants correct IDs.
      if (isDoctor && user) {
        if ((!departmentId || departmentId.trim() === "") && user.department) {
          if (typeof user.department === "string" && departments) {
            const userDept = departments.find((d: any) => d.name === user.department);
            if (userDept) departmentId = userDept.id;
          } else if (typeof user.department === "object" && user.department.id) {
            departmentId = user.department.id;
          }
        }
        if ((!doctorId || doctorId.trim() === "") && user.id) {
          doctorId = user.id;
        }
      }

      // Convert datetime-local format to ISO string (UTC) for backend
      // Validation is handled by Zod schema (15-minute interval check)
      let followupScheduledAtISO = values.followup_scheduled_at;
      if (followupScheduledAtISO) {
        try {
          const localDate = parseDateTimeLocal(followupScheduledAtISO);
          followupScheduledAtISO = toUTCISOString(localDate);
        } catch (error) {
          showError(t("prescriptions.invalidDateTime", { defaultValue: "Invalid date and time" }));
          return;
        }
      }

      try {
        const updatedPrescription = await updatePrescriptionStatus(
          prescription.id,
          "ISSUED",
          {
            create_followup: true,
            followup_scheduled_at: followupScheduledAtISO,
            followup_department_id: departmentId,
            followup_doctor_id: doctorId,
          }
        );
        
        // Extract prescription details for success message
        const patientName = updatedPrescription?.patient_name || prescription?.patient_name || "Patient";
        const prescriptionCode = updatedPrescription?.prescription_code || prescription?.prescription_code || prescription?.id?.substring(0, 8) || "";
        
        // Show success toast (single source of truth - child dialog shows toast)
        showSuccess(
          t("prescriptions.issueSuccessDetailed", {
            defaultValue: "Prescription {{code}} has been issued for {{name}}. Email notification has been sent.",
            code: prescriptionCode,
            name: patientName,
          })
        );
        
        reset();
        // Let parent close dialog and refresh data (don't call onClose here)
        onIssue({
          create_followup: true,
          followup_scheduled_at: followupScheduledAtISO,
          followup_department_id: departmentId,
          followup_doctor_id: doctorId,
        });
      } catch (error: any) {
        showError(
          error?.response?.data?.detail ||
          t("prescriptions.issueError", { defaultValue: "Failed to issue prescription" })
        );
      }
    } else {
      try {
        const updatedPrescription = await updatePrescriptionStatus(
          prescription.id,
          "ISSUED",
          { create_followup: false }
        );
        
        // Extract prescription details for success message
        const patientName = updatedPrescription?.patient_name || prescription?.patient_name || "Patient";
        const prescriptionCode = updatedPrescription?.prescription_code || prescription?.prescription_code || prescription?.id?.substring(0, 8) || "";
        
        // Show success toast (single source of truth - child dialog shows toast)
        showSuccess(
          t("prescriptions.issueSuccessDetailed", {
            defaultValue: "Prescription {{code}} has been issued for {{name}}. Email notification has been sent.",
            code: prescriptionCode,
            name: patientName,
          })
        );
        
        reset();
        // Let parent close dialog and refresh data (don't call onClose here)
        onIssue({ create_followup: false });
      } catch (error: any) {
        showError(
          error?.response?.data?.detail ||
          t("prescriptions.issueError", { defaultValue: "Failed to issue prescription" })
        );
      }
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t("prescriptions.issuePrescription", { defaultValue: "Issue Prescription" })}
      </DialogTitle>

      <form noValidate onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            {t("prescriptions.issueInfo", {
              defaultValue:
                "Issuing this prescription will finalize it and mark the linked appointment as completed.",
            })}
          </Alert>

          <FormControlLabel
            control={
              <Controller
                name="create_followup"
                control={control}
                render={({ field }) => (
                  <Checkbox checked={!!field.value} onChange={field.onChange} onBlur={field.onBlur} />
                )}
              />
            }
            label={t("prescriptions.followupRequired", { defaultValue: "Follow-up required?" })}
          />

          {createFollowup && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12 }}>
                <Controller
                  name="followup_scheduled_at"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label={t("prescriptions.followupDate", {
                        defaultValue: "Follow-up Date & Time *",
                      })}
                      type="datetime-local"
                      fullWidth
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      error={!!errors.followup_scheduled_at}
                      helperText={errors.followup_scheduled_at?.message || t("prescriptions.timeIntervalHint", { 
                        defaultValue: "Time must be in 15-minute intervals (00, 15, 30, 45)" 
                      })}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{
                        min: getMinDateTimeLocal(),
                        step: 900, // 15 minutes in seconds (for datetime-local input)
                      }}
                    />
                  )}
                />
              </Grid>

              {!isDoctor && (
                <>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                      name="followup_department_id"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          select
                          label={t("prescriptions.department", { defaultValue: "Department *" })}
                          fullWidth
                          value={field.value || ""}
                          onChange={(e) => {
                            // Department change resets doctor selection (keeps data consistent)
                            field.onChange(e.target.value);
                            setValue("followup_doctor_id", "", { shouldValidate: false, shouldDirty: true });
                          }}
                          onBlur={field.onBlur}
                          error={!!errors.followup_department_id}
                          helperText={errors.followup_department_id?.message}
                        >
                          {(departments || []).map((dept: any) => (
                            <MenuItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                      name="followup_doctor_id"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          select
                          label={t("prescriptions.doctor", { defaultValue: "Doctor *" })}
                          fullWidth
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          error={!!errors.followup_doctor_id}
                          helperText={
                            errors.followup_doctor_id?.message ||
                            (!selectedDepartmentId || selectedDepartmentId.trim() === ""
                              ? t("prescriptions.selectDepartmentFirst", {
                                  defaultValue: "Please select a department first",
                                })
                              : "")
                          }
                          disabled={!selectedDepartmentId || selectedDepartmentId.trim() === ""}
                        >
                          {(doctors || []).map((doc: any) => (
                            <MenuItem key={doc.id} value={doc.id}>
                              {doc.first_name} {doc.last_name || ""}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Grid>
                </>
              )}
            </Grid>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {t("prescriptions.issue", { defaultValue: "Issue" })}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default IssuePrescriptionDialog;