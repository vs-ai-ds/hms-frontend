// src/app/features/admissions/DischargeDialog.tsx
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from "@mui/material";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { apiClient } from "@app/lib/apiClient";
import { useToast } from "@app/components/common/ToastProvider";
import Grid from "@mui/material/Grid";

const dischargeSchema = z.object({
  discharge_datetime: z.string()
    .refine(
      (val) => {
        try {
          const date = new Date(val);
          return !isNaN(date.getTime());
        } catch {
          return false;
        }
      },
      "Invalid date and time"
    )
    .refine(
      (val) => {
        try {
          const date = new Date(val);
          const now = new Date();
          return date <= now;
        } catch {
          return false;
        }
      },
      "Discharge date and time cannot be in the future"
    ),
  discharge_summary: z.string().trim().min(1, "Discharge summary is required"),
});

type DischargeFormValues = z.infer<typeof dischargeSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onDischarged: () => void;
  admissionId: string;
  admitDatetime: string;
}

const DischargeDialog: React.FC<Props> = ({
  open,
  onClose,
  onDischarged,
  admissionId,
  admitDatetime,
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<DischargeFormValues>({
    resolver: zodResolver(dischargeSchema),
    defaultValues: {
      discharge_datetime: new Date().toISOString().slice(0, 16),
      discharge_summary: "",
    },
  });

  // Calculate default discharge time in local timezone format
  const getDefaultDischargeTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  React.useEffect(() => {
    if (open) {
      reset({
        discharge_datetime: getDefaultDischargeTime(),
        discharge_summary: "",
      });
    }
  }, [open, reset]);

  const onSubmit = async (values: DischargeFormValues) => {
    try {
      // Convert datetime-local format to ISO string (UTC)
      // datetime-local gives us local time, we need to convert to UTC ISO string
      let dischargeDatetime = values.discharge_datetime;
      if (dischargeDatetime) {
        if (!dischargeDatetime.includes('T')) {
          dischargeDatetime = `${dischargeDatetime}T00:00:00`;
        }
        // Create date from local time string (browser interprets as local time)
        const localDate = new Date(dischargeDatetime);
        if (isNaN(localDate.getTime())) {
          showError(t("admissions.invalidDateTime", { defaultValue: "Invalid date and time" }));
          return;
        }
        
        // Validate discharge time is greater than admit time
        const admitDate = new Date(admitDatetime);
        if (localDate <= admitDate) {
          showError(
            t("admissions.dischargeTimeBeforeAdmit", {
              defaultValue: "Discharge time must be greater than admission time.",
            })
          );
          return;
        }
        
        // Validate discharge time is not in the future
        const now = new Date();
        if (localDate > now) {
          showError(
            t("admissions.dischargeTimeFuture", {
              defaultValue: "Discharge date and time cannot be in the future.",
            })
          );
          return;
        }
        
        // Convert to ISO string (UTC) - this is what the backend expects
        dischargeDatetime = localDate.toISOString();
      }

      const payload = {
        discharge_datetime: dischargeDatetime,
        discharge_summary: values.discharge_summary,
      };

      await apiClient.patch(`/admissions/${admissionId}/discharge`, payload);
      reset();
      showSuccess(
        t("admissions.dischargeSuccess", {
          defaultValue: "Patient discharged successfully",
        })
      );
      onDischarged();
      onClose();
    } catch (error: any) {
      const errorDetail = error?.response?.data?.detail || "";
      showError(
        errorDetail ||
          t("admissions.dischargeError", {
            defaultValue: "Failed to discharge patient",
          })
      );
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t("admissions.dischargePatient", { defaultValue: "Discharge Patient" })}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12 }}>
            <TextField
              type="datetime-local"
              label={t("admissions.dischargeDatetime", {
                defaultValue: "Discharge Date & Time",
              })}
              fullWidth
              {...register("discharge_datetime")}
              error={!!errors.discharge_datetime}
              helperText={errors.discharge_datetime?.message}
              InputLabelProps={{ shrink: true }}
              required
              inputProps={{
                step: 900, // 15 minutes in seconds (for datetime-local input)
                min: (() => {
                  // Set minimum to admit time in local timezone format
                  const admitDate = new Date(admitDatetime);
                  const year = admitDate.getFullYear();
                  const month = String(admitDate.getMonth() + 1).padStart(2, '0');
                  const day = String(admitDate.getDate()).padStart(2, '0');
                  const hours = String(admitDate.getHours()).padStart(2, '0');
                  const minutes = String(admitDate.getMinutes()).padStart(2, '0');
                  return `${year}-${month}-${day}T${hours}:${minutes}`;
                })(),
                max: (() => {
                  // Set maximum to current time in local timezone format
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = String(now.getMonth() + 1).padStart(2, '0');
                  const day = String(now.getDate()).padStart(2, '0');
                  const hours = String(now.getHours()).padStart(2, '0');
                  const minutes = String(now.getMinutes()).padStart(2, '0');
                  return `${year}-${month}-${day}T${hours}:${minutes}`;
                })(),
              }}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              label={t("admissions.dischargeSummary", {
                defaultValue: "Discharge Summary",
              })}
              fullWidth
              multiline
              rows={4}
              required
              {...register("discharge_summary")}
              error={!!errors.discharge_summary}
              helperText={errors.discharge_summary?.message}
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
            ? t("admissions.discharging", { defaultValue: "Discharging..." })
            : t("admissions.discharge", { defaultValue: "Discharge" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DischargeDialog;
