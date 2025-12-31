// src/app/features/patients/PatientProfileEditDialog.tsx
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Tabs,
  Tab,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "@app/lib/apiClient";
import { useToast } from "@app/components/common/ToastProvider";
import { useTranslation } from "react-i18next";
import {
  INDIAN_STATES,
  INDIAN_LANGUAGES,
  INDIAN_ID_TYPES,
  EMERGENCY_CONTACT_RELATIONS,
  MARITAL_STATUS_OPTIONS,
} from "@app/lib/constants/indianConstants";

interface Patient {
  id: string;
  patient_code?: string | null;
  first_name: string;
  middle_name?: string | null;
  last_name?: string | null;
  dob?: string | null;
  dob_unknown?: boolean;
  age_only?: number | null;
  gender?: string | null;
  patient_type: "OPD" | "IPD";
  phone_primary?: string | null;
  phone_alternate?: string | null;
  email?: string | null;
  city?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  state?: string | null;
  country?: string | null;
  blood_group?: string | null;
  marital_status?: string | null;
  preferred_language?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_relation?: string | null;
  emergency_contact_phone?: string | null;
  known_allergies?: string | null;
  chronic_conditions?: string | null;
  clinical_notes?: string | null;
  is_dnr?: boolean;
  is_deceased?: boolean;
  date_of_death?: string | null;
  national_id_type?: string | null;
  national_id_number?: string | null;
  consent_sms?: boolean;
  consent_email?: boolean;
}

interface Props {
  open: boolean;
  patient: Patient;
  onClose: () => void;
  onUpdated: () => void;
}

const normalizePhone = (phone: string): string => {
  return phone.replace(/[\s\-\(\)]/g, "");
};

const validatePhoneDigits = (phone: string): boolean => {
  const normalized = normalizePhone(phone);
  const digits = normalized.startsWith("+") ? normalized.slice(1) : normalized;
  const digitCount = digits.split("").filter((c) => /[0-9]/.test(c)).length;
  return digitCount >= 8 && digitCount <= 15;
};

const profileSchema = z.object({
  middle_name: z.string().trim().optional(),
  last_name: z.string().trim().optional(),
  phone_alternate: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || validatePhoneDigits(val), {
      message: "Phone must be 8-15 digits",
    }),
  email: z.string().email().optional().or(z.literal("")),
  city: z.string().trim().min(2).max(80),
  address_line1: z.string().trim().min(3).max(120).optional().or(z.literal("")),
  address_line2: z.string().trim().min(3).max(120).optional().or(z.literal("")),
  postal_code: z.string().trim().optional(),
  state: z.string().trim().optional(),
  country: z.string().trim().optional(),
  blood_group: z.string().trim().optional(),
  marital_status: z.string().trim().optional(),
  preferred_language: z.string().trim().optional(),
  emergency_contact_name: z.string().trim().optional(),
  emergency_contact_relation: z.string().trim().optional(),
  emergency_contact_phone: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || validatePhoneDigits(val), {
      message: "Phone must be 8-15 digits",
    }),
  known_allergies: z.string().trim().max(1000).optional(),
  chronic_conditions: z.string().trim().max(1000).optional(),
  clinical_notes: z.string().trim().max(1000).optional(),
  is_dnr: z.boolean().optional(),
  is_deceased: z.boolean().optional(),
  date_of_death: z.string().optional(),
  national_id_type: z.string().trim().optional(),
  national_id_number: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9\-/]+$/)
    .optional()
    .or(z.literal("")),
  consent_sms: z.boolean().optional(),
  consent_email: z.boolean().optional(),
}).refine(
  (data) => {
    const hasName = !!data.emergency_contact_name?.trim();
    const hasPhone = !!data.emergency_contact_phone?.trim();
    if (hasName || hasPhone) {
      return hasName && hasPhone;
    }
    return true;
  },
  {
    message: "Emergency contact requires both name and phone",
    path: ["emergency_contact_phone"],
  }
);

type ProfileFormValues = z.infer<typeof profileSchema>;

const PatientProfileEditDialog: React.FC<Props> = ({
  open,
  patient,
  onClose,
  onUpdated,
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const [tabValue, setTabValue] = React.useState(0);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: "onBlur", // Validate on blur
      defaultValues: {
        middle_name: patient.middle_name || "",
        last_name: patient.last_name || "",
        phone_alternate: patient.phone_alternate || "",
        email: patient.email || "",
        address_line1: patient.address_line1 || "",
        address_line2: patient.address_line2 || "",
        city: patient.city || "",
        postal_code: patient.postal_code || "",
        state: patient.state || "",
        country: "India", // Fixed to India
        blood_group: patient.blood_group || "",
        marital_status: patient.marital_status || "",
        preferred_language: patient.preferred_language || "",
        emergency_contact_name: patient.emergency_contact_name || "",
        emergency_contact_relation: patient.emergency_contact_relation || "",
        emergency_contact_phone: patient.emergency_contact_phone || "",
        known_allergies: patient.known_allergies || "",
        chronic_conditions: patient.chronic_conditions || "",
        clinical_notes: patient.clinical_notes || "",
        is_dnr: patient.is_dnr || false,
        is_deceased: patient.is_deceased || false,
        date_of_death: patient.date_of_death
          ? new Date(patient.date_of_death).toISOString().split("T")[0]
          : "",
        national_id_type: patient.national_id_type || "",
        national_id_number: patient.national_id_number || "",
        consent_sms: patient.consent_sms || false,
        consent_email: patient.consent_email || false,
      },
  });

  React.useEffect(() => {
    if (open && patient) {
      reset({
        middle_name: patient.middle_name || "",
        last_name: patient.last_name || "",
        phone_alternate: patient.phone_alternate || "",
        email: patient.email || "",
        address_line1: patient.address_line1 || "",
        address_line2: patient.address_line2 || "",
        city: patient.city || "",
        postal_code: patient.postal_code || "",
        state: patient.state || "",
        country: patient.country || "India",
        blood_group: patient.blood_group || "",
        marital_status: patient.marital_status || "",
        preferred_language: patient.preferred_language || "",
        emergency_contact_name: patient.emergency_contact_name || "",
        emergency_contact_relation: patient.emergency_contact_relation || "",
        emergency_contact_phone: patient.emergency_contact_phone || "",
        known_allergies: patient.known_allergies || "",
        chronic_conditions: patient.chronic_conditions || "",
        clinical_notes: patient.clinical_notes || "",
        is_dnr: patient.is_dnr || false,
        is_deceased: patient.is_deceased || false,
        date_of_death: patient.date_of_death
          ? new Date(patient.date_of_death).toISOString().split("T")[0]
          : "",
        national_id_type: patient.national_id_type || "",
        national_id_number: patient.national_id_number || "",
        consent_sms: patient.consent_sms || false,
        consent_email: patient.consent_email || false,
      });
    }
  }, [open, patient, reset]);

  // Reset form and tab when dialog closes
  React.useEffect(() => {
    if (!open) {
      reset();
      setTabValue(0);
    }
  }, [open, reset]);

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      const payload: any = {};
      Object.keys(values).forEach((key) => {
        const value = values[key as keyof ProfileFormValues];
        if (value !== "" && value !== null && value !== undefined) {
          payload[key] = value;
        } else if (value === "") {
          payload[key] = null;
        }
      })

      // Ensure city is included if it exists
      if (values.city !== undefined) {
        payload.city = values.city || null;
      }

      // Normalize phone numbers
      if (payload.phone_alternate) {
        payload.phone_alternate = normalizePhone(payload.phone_alternate);
      }
      if (payload.emergency_contact_phone) {
        payload.emergency_contact_phone = normalizePhone(
          payload.emergency_contact_phone
        );
      }

      // Ensure country is always India
      payload.country = "India";

      await apiClient.patch(`/patients/${patient.id}/profile`, payload);
      showSuccess(
        t("patients.profileUpdated", { defaultValue: "Patient: {{name}} Profile updated successfully", name: patient.first_name + " " + patient.middle_name + " " + patient.last_name })
      );
      onUpdated?.();
      onClose?.();
    } catch (error: any) {
      const errorMessage = 
        (typeof error?.response?.data?.detail === "string" 
          ? error.response.data.detail 
          : null) ||
        t("patients.profileUpdateError", {
          defaultValue: "Failed to update patient profile",
        });
      showError(errorMessage);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {t("patients.editProfile", { defaultValue: "Edit Patient Profile" })}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab
              label={t("patients.contactDemographics", { defaultValue: "Contact & Demographics" })}
            />
            <Tab
              label={t("patients.medical", { defaultValue: "Medical" })}
            />
            <Tab
              label={t("patients.preferencesConsent", { defaultValue: "Preferences & Consent" })}
            />
          </Tabs>
        </Box>

        <form onSubmit={handleSubmit(onSubmit)}>
          {tabValue === 0 && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={t("patients.middleName", { defaultValue: "Middle Name" })}
                  fullWidth
                  {...register("middle_name")}
                  error={!!errors.middle_name}
                  helperText={errors.middle_name?.message}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={t("patients.lastName", { defaultValue: "Last Name" })}
                  fullWidth
                  {...register("last_name")}
                  error={!!errors.last_name}
                  helperText={errors.last_name?.message}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={t("patients.phoneAlternate", {
                    defaultValue: "Alternate Phone",
                  })}
                  fullWidth
                  {...register("phone_alternate")}
                  error={!!errors.phone_alternate}
                  helperText={errors.phone_alternate?.message}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={t("patients.email", { defaultValue: "Email" })}
                  type="email"
                  fullWidth
                  {...register("email")}
                  error={!!errors.email}
                  helperText={errors.email?.message}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label={t("patients.addressLine1", {
                    defaultValue: "Address Line 1",
                  })}
                  fullWidth
                  {...register("address_line1")}
                  error={!!errors.address_line1}
                  helperText={errors.address_line1?.message}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label={t("patients.addressLine2", {
                    defaultValue: "Address Line 2",
                  })}
                  fullWidth
                  {...register("address_line2")}
                  error={!!errors.address_line2}
                  helperText={errors.address_line2?.message}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label={t("patients.city", { defaultValue: "City" })}
                  fullWidth
                  required
                  {...register("city")}
                  error={!!errors.city}
                  helperText={errors.city?.message}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Controller
                  name="state"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      select
                      label={t("patients.state", { defaultValue: "State" })}
                      fullWidth
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      error={!!errors.state}
                      helperText={errors.state?.message}
                    >
                      <MenuItem value="">{t("common.select", { defaultValue: "Select..." })}</MenuItem>
                      {INDIAN_STATES.map((state) => (
                        <MenuItem key={state} value={state}>
                          {state}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label={t("patients.postalCode", {
                    defaultValue: "Pin Code",
                  })}
                  fullWidth
                  inputProps={{ maxLength: 6, pattern: "[0-9]*" }}
                  {...register("postal_code")}
                  error={!!errors.postal_code}
                  helperText={errors.postal_code?.message || t("patients.pinCodeHelper", { defaultValue: "6 digits only" })}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label={t("patients.country", { defaultValue: "Country" })}
                  fullWidth
                  value="India"
                  disabled
                  {...register("country")}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                  {t("patients.emergencyContact", {
                    defaultValue: "Emergency Contact",
                  })}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label={t("patients.emergencyContactName", {
                    defaultValue: "Name",
                  })}
                  fullWidth
                  {...register("emergency_contact_name")}
                  error={!!errors.emergency_contact_name}
                  helperText={errors.emergency_contact_name?.message}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Controller
                  name="emergency_contact_relation"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      select
                      label={t("patients.emergencyContactRelation", {
                        defaultValue: "Relation",
                      })}
                      fullWidth
                      {...field}
                      error={!!errors.emergency_contact_relation}
                      helperText={errors.emergency_contact_relation?.message}
                    >
                      <MenuItem value="">{t("common.select", { defaultValue: "Select..." })}</MenuItem>
                      {EMERGENCY_CONTACT_RELATIONS.map((relation) => (
                        <MenuItem key={relation} value={relation}>
                          {relation}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label={t("patients.emergencyContactPhone", {
                    defaultValue: "Phone",
                  })}
                  fullWidth
                  {...register("emergency_contact_phone")}
                  error={!!errors.emergency_contact_phone}
                  helperText={errors.emergency_contact_phone?.message}
                />
              </Grid>
            </Grid>
          )}

          {tabValue === 1 && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label={t("patients.knownAllergies", {
                    defaultValue: "Known Allergies",
                  })}
                  fullWidth
                  multiline
                  rows={3}
                  {...register("known_allergies")}
                  error={!!errors.known_allergies}
                  helperText={errors.known_allergies?.message}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label={t("patients.chronicConditions", {
                    defaultValue: "Chronic Conditions",
                  })}
                  fullWidth
                  multiline
                  rows={3}
                  {...register("chronic_conditions")}
                  error={!!errors.chronic_conditions}
                  helperText={errors.chronic_conditions?.message}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label={t("patients.clinicalNotes", {
                    defaultValue: "Clinical Notes",
                  })}
                  fullWidth
                  multiline
                  rows={4}
                  {...register("clinical_notes")}
                  error={!!errors.clinical_notes}
                  helperText={errors.clinical_notes?.message}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  name="blood_group"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      select
                      label={t("patients.bloodGroup", {
                        defaultValue: "Blood Group",
                      })}
                      fullWidth
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      error={!!errors.blood_group}
                      helperText={errors.blood_group?.message}
                    >
                      <MenuItem value="">{t("common.none", { defaultValue: "None" })}</MenuItem>
                      <MenuItem value="A+">A+</MenuItem>
                      <MenuItem value="A-">A-</MenuItem>
                      <MenuItem value="B+">B+</MenuItem>
                      <MenuItem value="B-">B-</MenuItem>
                      <MenuItem value="AB+">AB+</MenuItem>
                      <MenuItem value="AB-">AB-</MenuItem>
                      <MenuItem value="O+">O+</MenuItem>
                      <MenuItem value="O-">O-</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  name="is_dnr"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={field.value || false}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                      }
                      label={t("patients.dnr", { defaultValue: "DNR (Do Not Resuscitate)" })}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, flexWrap: "wrap" }}>
                  <Controller
                    name="is_deceased"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={field.value || false}
                            onChange={(e) => {
                              field.onChange(e.target.checked);
                              // Clear date of death when deceased is unchecked
                              if (!e.target.checked) {
                                setValue("date_of_death", "");
                              }
                            }}
                            onBlur={field.onBlur}
                          />
                        }
                        label={t("patients.deceased", { defaultValue: "Deceased" })}
                      />
                    )}
                  />
                  {watch("is_deceased") && (
                    <TextField
                      label={t("patients.dateOfDeath", {
                        defaultValue: "Date of Death",
                      })}
                      type="date"
                      size="small"
                      sx={{ width: 200, flexShrink: 0 }}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{
                        max: new Date().toISOString().split("T")[0],
                        min: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                      }}
                      {...register("date_of_death")}
                      error={!!errors.date_of_death}
                      helperText={errors.date_of_death?.message || t("patients.dateOfDeathHelper", { defaultValue: "Last 30 days only" })}
                    />
                  )}
                </Box>
              </Grid>
            </Grid>
          )}

          {tabValue === 2 && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  name="marital_status"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      select
                      label={t("patients.maritalStatus", {
                        defaultValue: "Marital Status",
                      })}
                      fullWidth
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      error={!!errors.marital_status}
                      helperText={errors.marital_status?.message}
                    >
                      <MenuItem value="">{t("common.select", { defaultValue: "Select..." })}</MenuItem>
                      {MARITAL_STATUS_OPTIONS.map((status) => (
                        <MenuItem key={status} value={status}>
                          {status}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  name="preferred_language"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      select
                      label={t("patients.preferredLanguage", {
                        defaultValue: "Preferred Language",
                      })}
                      fullWidth
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      error={!!errors.preferred_language}
                      helperText={errors.preferred_language?.message}
                    >
                      <MenuItem value="">{t("common.select", { defaultValue: "Select..." })}</MenuItem>
                      {INDIAN_LANGUAGES.map((language) => (
                        <MenuItem key={language} value={language}>
                          {language}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  name="national_id_type"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      select
                      label={t("patients.nationalIdType", {
                        defaultValue: "National ID Type",
                      })}
                      fullWidth
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      error={!!errors.national_id_type}
                      helperText={errors.national_id_type?.message}
                    >
                      <MenuItem value="">{t("common.select", { defaultValue: "Select..." })}</MenuItem>
                      {INDIAN_ID_TYPES.map((idType) => (
                        <MenuItem key={idType} value={idType}>
                          {idType}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={t("patients.nationalIdNumber", {
                    defaultValue: "National ID Number",
                  })}
                  fullWidth
                  {...register("national_id_number")}
                  error={!!errors.national_id_number}
                  helperText={errors.national_id_number?.message}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                  {t("patients.consent", { defaultValue: "Consent" })}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  name="consent_sms"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox {...field} checked={field.value || false} />}
                      label={t("patients.consentSms", {
                        defaultValue: "SMS Consent",
                      })}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  name="consent_email"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox {...field} checked={field.value || false} />}
                      label={t("patients.consentEmail", {
                        defaultValue: "Email Consent",
                      })}
                    />
                  )}
                />
              </Grid>
            </Grid>
          )}
        </form>
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
            ? t("common.saving", { defaultValue: "Saving..." })
            : t("common.save", { defaultValue: "Save" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PatientProfileEditDialog;

