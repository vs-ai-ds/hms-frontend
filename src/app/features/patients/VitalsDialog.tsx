// src/app/features/patients/VitalsDialog.tsx
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { apiClient } from "@app/lib/apiClient";
import { useToast } from "@app/components/common/ToastProvider";


// Helper to convert Fahrenheit to Celsius
const fahrenheitToCelsius = (f: number): number => {
  return ((f - 32) * 5) / 9;
};

const vitalsSchema = z.object({
  systolic_bp: z.number().min(0).max(300).optional().nullable(),
  diastolic_bp: z.number().min(0).max(300).optional().nullable(),
  heart_rate: z.number().min(0).max(300).optional().nullable(),
  temperature_f: z.number().min(86).max(113).optional().nullable(), // 86°F = 30°C, 113°F = 45°C
  respiratory_rate: z.number().min(0).max(100).optional().nullable(),
  spo2: z.number().min(0).max(100).optional().nullable(),
  weight_kg: z.number().min(0).max(500).optional().nullable(),
  height_cm: z.number().min(0).max(300).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  recorded_at: z.string().optional(),
});

type VitalsFormValues = z.infer<typeof vitalsSchema>;

interface Props {
  open: boolean;
  patientId: string;
  appointmentId?: string | null;
  admissionId?: string | null;
  onClose: () => void;
  onRecorded: () => void;
}

const VitalsDialog: React.FC<Props> = ({
  open,
  patientId,
  appointmentId,
  admissionId,
  onClose,
  onRecorded,
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<VitalsFormValues>({
    resolver: zodResolver(vitalsSchema),
    defaultValues: {
      recorded_at: new Date().toISOString().slice(0, 16),
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        recorded_at: new Date().toISOString().slice(0, 16),
      });
    }
  }, [open, reset]);

  const onSubmit = async (values: VitalsFormValues) => {
    try {
      // Convert datetime-local to ISO string
      let recordedAt = values.recorded_at;
      if (recordedAt) {
        if (!recordedAt.includes('T')) {
          recordedAt = `${recordedAt}T00:00:00`;
        }
        const date = new Date(recordedAt);
        if (!isNaN(date.getTime())) {
          recordedAt = date.toISOString();
        } else {
          recordedAt = new Date().toISOString();
        }
      } else {
        recordedAt = new Date().toISOString();
      }

      const payload: any = {
        patient_id: patientId,
        appointment_id: appointmentId || null,
        admission_id: admissionId || null,
        recorded_at: recordedAt,
      };

      // Only include fields that have values
      if (values.systolic_bp !== null && values.systolic_bp !== undefined) {
        payload.systolic_bp = values.systolic_bp;
      }
      if (values.diastolic_bp !== null && values.diastolic_bp !== undefined) {
        payload.diastolic_bp = values.diastolic_bp;
      }
      if (values.heart_rate !== null && values.heart_rate !== undefined) {
        payload.heart_rate = values.heart_rate;
      }
      if (values.temperature_f !== null && values.temperature_f !== undefined) {
        // Convert Fahrenheit to Celsius for backend
        payload.temperature_c = fahrenheitToCelsius(values.temperature_f);
      }
      if (values.respiratory_rate !== null && values.respiratory_rate !== undefined) {
        payload.respiratory_rate = values.respiratory_rate;
      }
      if (values.spo2 !== null && values.spo2 !== undefined) {
        payload.spo2 = values.spo2;
      }
      if (values.weight_kg !== null && values.weight_kg !== undefined) {
        payload.weight_kg = values.weight_kg;
      }
      if (values.height_cm !== null && values.height_cm !== undefined) {
        payload.height_cm = values.height_cm;
      }
      if (values.notes) {
        payload.notes = values.notes;
      }

      await apiClient.post("/vitals", payload);
      showSuccess(
        t("vitals.recordedSuccess", {
          defaultValue: "Vitals recorded successfully",
        })
      );
      reset();
      onRecorded();
      onClose();
    } catch (error: any) {
      showError(
        error?.response?.data?.detail ||
          t("vitals.recordError", {
            defaultValue: "Failed to record vitals",
          })
      );
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t("vitals.recordVitals", { defaultValue: "Record Vitals" })}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label={t("vitals.systolicBp", { defaultValue: "Systolic BP (mmHg)" })}
              type="number"
              fullWidth
              {...register("systolic_bp", { valueAsNumber: true })}
              error={!!errors.systolic_bp}
              helperText={errors.systolic_bp?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label={t("vitals.diastolicBp", { defaultValue: "Diastolic BP (mmHg)" })}
              type="number"
              fullWidth
              {...register("diastolic_bp", { valueAsNumber: true })}
              error={!!errors.diastolic_bp}
              helperText={errors.diastolic_bp?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label={t("vitals.heartRate", { defaultValue: "Heart Rate (bpm)" })}
              type="number"
              fullWidth
              {...register("heart_rate", { valueAsNumber: true })}
              error={!!errors.heart_rate}
              helperText={errors.heart_rate?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label={t("vitals.temperature", { defaultValue: "Temperature (°F)" })}
              type="number"
              fullWidth
              inputProps={{ step: 0.1, min: 86, max: 113 }}
              {...register("temperature_f", { valueAsNumber: true })}
              error={!!errors.temperature_f}
              helperText={errors.temperature_f?.message || t("vitals.temperatureHelper", { defaultValue: "Normal range: 96.8-100.4°F" })}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label={t("vitals.respiratoryRate", { defaultValue: "Respiratory Rate (per min)" })}
              type="number"
              fullWidth
              {...register("respiratory_rate", { valueAsNumber: true })}
              error={!!errors.respiratory_rate}
              helperText={errors.respiratory_rate?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label={t("vitals.spo2", { defaultValue: "SpO2 (%)" })}
              type="number"
              fullWidth
              {...register("spo2", { valueAsNumber: true })}
              error={!!errors.spo2}
              helperText={errors.spo2?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label={t("vitals.weight", { defaultValue: "Weight (kg)" })}
              type="number"
              fullWidth
              inputProps={{ step: 0.1 }}
              {...register("weight_kg", { valueAsNumber: true })}
              error={!!errors.weight_kg}
              helperText={errors.weight_kg?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label={t("vitals.height", { defaultValue: "Height (cm)" })}
              type="number"
              fullWidth
              inputProps={{ step: 0.1 }}
              {...register("height_cm", { valueAsNumber: true })}
              error={!!errors.height_cm}
              helperText={errors.height_cm?.message}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              type="datetime-local"
              label={t("vitals.recordedAt", { defaultValue: "Recorded At" })}
              fullWidth
              {...register("recorded_at")}
              error={!!errors.recorded_at}
              inputProps={{
                step: 900, // 15 minutes in seconds (for datetime-local input)
              }}
              helperText={errors.recorded_at?.message}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              label={t("vitals.notes", { defaultValue: "Notes (Optional)" })}
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
          onClick={handleSubmit(onSubmit)}
          variant="contained"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? t("common.recording", { defaultValue: "Recording..." })
            : t("vitals.record", { defaultValue: "Record" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VitalsDialog;
