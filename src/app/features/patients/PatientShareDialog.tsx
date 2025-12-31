// src/app/features/patients/PatientShareDialog.tsx
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Checkbox,
  Typography,
  Alert,
  CircularProgress,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@app/components/common/ToastProvider";
import {
  createPatientShare,
  fetchTenantsForSharing,
} from "@app/lib/api/patientShares";
import { formatDate } from "@app/lib/dateFormat";

const shareSchema = z.object({
  target_tenant_id: z.string().uuid("Target hospital is required"),
  share_mode: z.enum(["READ_ONLY_LINK", "CREATE_RECORD"]),
  validity_days: z.number().min(1).max(30),
  note: z.string().max(500).optional().nullable(),
  consent_confirmed: z.boolean().refine((val) => val === true, {
    message: "You must confirm patient consent to share data",
  }),
});

type ShareFormValues = z.infer<typeof shareSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: string;
}

const PatientShareDialog: React.FC<Props> = ({ open, onClose, patientId }) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [tenantSearch, setTenantSearch] = React.useState("");

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<ShareFormValues>({
    resolver: zodResolver(shareSchema),
    defaultValues: {
      share_mode: "READ_ONLY_LINK",
      validity_days: 7,
      note: null,
      consent_confirmed: false,
      target_tenant_id: "",
    },
  });

  const { data: tenants, isLoading: loadingTenants } = useQuery({
    queryKey: ["tenants-for-sharing", tenantSearch],
    queryFn: () => fetchTenantsForSharing(tenantSearch || undefined),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: (data: { target_tenant_id: string; share_mode: "READ_ONLY_LINK" | "CREATE_RECORD"; validity_days: number; consent_confirmed: boolean; note?: string | undefined }) => createPatientShare(patientId, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["patient-shares"] });
      const targetHospital = tenants?.find((t) => t.id === response.target_tenant_id)?.name || response.target_tenant_name || "the selected hospital";
      const shareModeText = response.share_mode === "READ_ONLY_LINK" 
        ? t("patients.readOnlyMode", { defaultValue: "read-only" })
        : t("patients.writeEnabledMode", { defaultValue: "write-enabled" });
      const expiresAtText = response.expires_at
        ? t("patients.expiresOn", { defaultValue: `expires on ${formatDate(response.expires_at)}`, date: formatDate(response.expires_at) })
        : t("patients.neverExpires", { defaultValue: "never expires" });
      
      showSuccess(
        t("patients.shareSuccessDetailed", {
          defaultValue: `Patient record "${response.patient_name || 'Unknown'}" (${response.patient_code || 'N/A'}) has been successfully shared with ${targetHospital} in ${shareModeText} mode. The share ${expiresAtText}.`,
          patientName: response.patient_name || "Unknown",
          patientCode: response.patient_code || "N/A",
          targetHospital,
          shareModeText,
          expiresAtText,
        })
      );
      reset();
      onClose();
    },
    onError: (error: any) => {
      showError(
        error?.response?.data?.detail ||
          t("patients.shareError", {
            defaultValue: "Failed to share patient record",
          })
      );
    },
  });

  const onSubmit = (data: ShareFormValues) => {
    const payload = {
      target_tenant_id: data.target_tenant_id,
      share_mode: data.share_mode,
      validity_days: data.validity_days,
      consent_confirmed: data.consent_confirmed,
      note: data.note && data.note.trim() ? data.note.trim() : undefined,
    };
    createMutation.mutate(payload);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      reset();
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t("patients.sharePatientRecord", { defaultValue: "Share Patient Record" })}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12 }}>
            <Alert severity="info" sx={{ mb: 1 }}>
              {t("patients.shareInfo", {
                defaultValue:
                  "Share patient data with another hospital. Ensure you have patient consent before sharing.",
              })}
            </Alert>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Controller
              name="share_mode"
              control={control}
              render={({ field }) => (
                <FormControl component="fieldset">
                  <FormLabel component="legend">
                    {t("patients.shareMode", { defaultValue: "Share Mode" })}
                  </FormLabel>
                  <RadioGroup {...field}>
                    <FormControlLabel
                      value="READ_ONLY_LINK"
                      control={<Radio />}
                      label={t("patients.readOnlyLink", {
                        defaultValue: "Receiver can only view patient record",
                      })}
                    />
                    <FormControlLabel
                      value="CREATE_RECORD"
                      control={<Radio />}
                      label={t("patients.writeEnabledLink", {
                        defaultValue: "Receiver can view and create patient record",
                      })}
                    />
                  </RadioGroup>
                </FormControl>
              )}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Controller
              name="target_tenant_id"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  options={tenants || []}
                  loading={loadingTenants}
                  getOptionLabel={(option) => option.name}
                  value={
                    tenants?.find((t) => t.id === field.value) || null
                  }
                  onChange={(_, value) => field.onChange(value?.id || "")}
                  onInputChange={(_, newValue) => setTenantSearch(newValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t("patients.targetHospital", {
                        defaultValue: "Target Hospital",
                      })}
                      error={!!errors.target_tenant_id}
                      helperText={errors.target_tenant_id?.message || t("patients.targetHospitalHelper", {
                        defaultValue: "Select an active hospital to share the patient record with",
                      })}
                      required
                    />
                  )}
                />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Controller
              name="validity_days"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="number"
                  label={t("patients.validityDays", {
                    defaultValue: "Validity (days)",
                  })}
                  fullWidth
                  inputProps={{ min: 1, max: 30 }}
                  error={!!errors.validity_days}
                  helperText={errors.validity_days?.message}
                  required
                  onChange={(e) => {
                    const value = e.target.value === "" ? "" : Number(e.target.value);
                    field.onChange(value);
                  }}
                  value={field.value ?? ""}
                />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Controller
              name="note"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t("patients.note", { defaultValue: "Note (Optional)" })}
                  fullWidth
                  multiline
                  rows={2}
                  error={!!errors.note}
                  helperText={errors.note?.message}
                />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Controller
              name="consent_confirmed"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      {t("patients.consentConfirm", {
                        defaultValue:
                          "I confirm we have patient consent to share this data",
                      })}
                    </Typography>
                  }
                />
              )}
            />
            {errors.consent_confirmed && (
              <Typography color="error" variant="caption" sx={{ ml: 4, display: "block" }}>
                {errors.consent_confirmed.message}
              </Typography>
            )}
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ pr: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={isSubmitting}>
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          onClick={handleSubmit(onSubmit)}
          variant="contained"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <CircularProgress size={20} />
          ) : (
            t("patients.share", { defaultValue: "Share" })
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PatientShareDialog;

