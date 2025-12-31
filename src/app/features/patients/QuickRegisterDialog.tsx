// src/app/features/patients/QuickRegisterDialog.tsx
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  Alert,
} from "@mui/material";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  quickRegisterSchema,
  type QuickRegisterFormValues,
} from "@app/lib/validation/quickRegisterValidation";
import { apiClient } from "@app/lib/apiClient";
import { useToast } from "@app/components/common/ToastProvider";
import { useTranslation } from "react-i18next";
import Grid from "@mui/material/Grid";
import { useNavigate } from "react-router-dom";
import { AppRoutes } from "@app/routes";
import DuplicateDetectionModal from "./DuplicateDetectionModal";
import AppointmentFormDialog from "@app/features/appointments/AppointmentFormDialog";
import AdmissionFormDialog from "@app/features/admissions/AdmissionFormDialog";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface DuplicateCandidate {
  id: string;
  patient_code: string | null;
  first_name: string;
  last_name: string | null;
  dob: string | null;
  phone_primary: string | null;
  age: number | null;
  last_visited_at: string | null;
  match_score: number;
  match_reason: string;
}

type Step = "patient" | "visitType" | "appointment" | "admission";

const QuickRegisterDialog: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>("patient");
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [createdPatientId, setCreatedPatientId] = useState<string | null>(null);
  const [createdPatientName, setCreatedPatientName] = useState<string>("");
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [admissionDialogOpen, setAdmissionDialogOpen] = useState(false);
  const [phoneWarning, setPhoneWarning] = useState<string | null>(null);
  const [wasCreateVisitNowChecked, setWasCreateVisitNowChecked] = useState<boolean>(true);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    trigger,
    formState: { isSubmitting, errors },
  } = useForm<QuickRegisterFormValues>({
    resolver: zodResolver(quickRegisterSchema),
    mode: "onChange", // Validate on change to catch errors immediately
    defaultValues: {
      gender: undefined, // No default - user must select
      dob_unknown: false,
      create_visit_now: true,
    },
  });

  const dobUnknown = watch("dob_unknown");
  const createVisitNow = watch("create_visit_now");

  // Check for duplicate phone numbers
  const checkPhoneDuplicate = async (phone: string) => {
    if (!phone || phone.length < 8) return;
    try {
      const normalizedPhone = phone.replace(/[\s\-\(\)]/g, "").trim();
      const firstName = watch("first_name");
      if (!firstName) return;

      const duplicateCheck = await apiClient.get("/patients/check-duplicates", {
        params: {
          first_name: firstName.trim(),
          last_name: watch("last_name")?.trim() || undefined, // Use undefined instead of null
          dob: watch("dob") ? watch("dob")!.toISOString().split("T")[0] : undefined,
          phone_primary: normalizedPhone,
        },
      });

      if (duplicateCheck.data.has_duplicates) {
        setPhoneWarning(
          t("patients.duplicatePhoneWarning", {
            defaultValue: "A patient with this phone number already exists. Duplicates are allowed for families.",
          })
        );
      } else {
        setPhoneWarning(null);
      }
    } catch (err) {
      // Ignore errors - this is just a warning check
    }
  };

  // Step 1: Create Patient
  const onSubmitPatient = async (values: QuickRegisterFormValues) => {
    // Validate gender is set (should be set by default, but ensure it)
    if (!values.gender || !["MALE", "FEMALE", "OTHER", "UNKNOWN"].includes(values.gender)) {
      showError(t("patients.genderRequired", { defaultValue: "Gender is required" }));
      return;
    }
    
    try {
      const normalizedPhone = values.phone_primary.replace(/[\s\-\(\)]/g, "").trim();

      const payload = {
        first_name: values.first_name.trim(),
        last_name: values.last_name?.trim() || null,
        phone_primary: normalizedPhone,
        email: values.email?.trim() || null,
        city: values.city.trim(),
        gender: values.gender,
        dob: values.dob ? values.dob.toISOString().split("T")[0] : null,
        dob_unknown: values.dob_unknown,
        age_only: values.dob_unknown ? (values.age_only || null) : null,
      };

      const response = await apiClient.post("/patients/quick-register", payload);
      const patient = response.data;
      setCreatedPatientId(patient.id);
      setCreatedPatientName(`${patient.first_name} ${patient.last_name || ""}`.trim());

      // Show success message (use direct string since interpolation might not work in all cases)
      const patientName = `${patient.first_name} ${patient.last_name || ""}`.trim();
      showSuccess(
        t("patients.quickRegisterSuccess", {
          defaultValue: `Patient created: ${patientName}`,
          name: patientName,
        }) || `Patient created: ${patientName}`
      );

      // Check for duplicates (non-blocking - don't prevent flow if it fails)
      // IMPORTANT: Exclude the newly created patient to avoid matching with itself
      try {
        const duplicateCheck = await apiClient.get("/patients/check-duplicates", {
          params: {
            first_name: values.first_name.trim(),
            last_name: values.last_name?.trim() || undefined, // Use undefined instead of null for optional params
            dob: values.dob ? values.dob.toISOString().split("T")[0] : undefined,
            phone_primary: normalizedPhone,
            exclude_patient_id: patient.id, // Exclude the newly created patient
          },
        });

        // Only show duplicate modal if there are OTHER patients (not the one we just created)
        if (duplicateCheck.data.has_duplicates && duplicateCheck.data.candidates.length > 0) {
          setDuplicateCandidates(duplicateCheck.data.candidates);
          setDuplicateModalOpen(true);
          // Don't return here - let the user decide what to do, but still proceed with visit creation if they want
        }
      } catch (err: any) {
        // Log but don't block - duplicate check is informational, not required
        console.warn("Duplicate check failed (non-blocking):", err?.response?.data || err);
        // Don't show error toast - this is just a warning check
      }

      // Track if create_visit_now was checked
      setWasCreateVisitNowChecked(values.create_visit_now || false);

      // If "Create visit now" is checked, proceed to visit type selection
      // This should happen regardless of duplicate check result
      if (values.create_visit_now) {
        // Move to step 2: Visit Type selection
        setCurrentStep("visitType");
      } else {
        // If unchecked, close and stay on list
        reset({
          gender: undefined,
          dob_unknown: false,
          create_visit_now: true,
        });
        setCurrentStep("patient");
        setCreatedPatientId(null);
        setCreatedPatientName("");
        setPhoneWarning(null);
        onCreated();
        onClose();
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail ||
        error?.response?.data?.message ||
        t("patients.quickRegisterError", {
          defaultValue: "Failed to create patient",
        });
      showError(errorMessage);
      // Don't reset form on error - let user fix and retry
    }
  };

  // Step 2: Visit Type Selection
  const handleVisitTypeSelect = (visitType: "OPD" | "IPD") => {
    if (!createdPatientId) return;

    if (visitType === "OPD") {
      setCurrentStep("appointment");
      setAppointmentDialogOpen(true);
    } else {
      setCurrentStep("admission");
      setAdmissionDialogOpen(true);
    }
  };

  const handleBack = () => {
    if (currentStep === "visitType") {
      setCurrentStep("patient");
    } else if (currentStep === "appointment" || currentStep === "admission") {
      setCurrentStep("visitType");
      setAppointmentDialogOpen(false);
      setAdmissionDialogOpen(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      reset({
        gender: undefined,
        dob_unknown: false,
        create_visit_now: true,
      });
      setCurrentStep("patient");
      setDuplicateCandidates([]);
      setCreatedPatientId(null);
      setCreatedPatientName("");
      setPhoneWarning(null);
      setAppointmentDialogOpen(false);
      setAdmissionDialogOpen(false);
      setWasCreateVisitNowChecked(true);
      onClose();
    }
  };

  // Reset form when dialog opens if previous submission didn't have create_visit_now checked
  useEffect(() => {
    if (open && !wasCreateVisitNowChecked) {
      reset({
        gender: undefined,
        dob_unknown: false,
        create_visit_now: true,
      });
      setCurrentStep("patient");
      setCreatedPatientId(null);
      setCreatedPatientName("");
      setPhoneWarning(null);
      setDuplicateCandidates([]);
      setWasCreateVisitNowChecked(true);
    }
  }, [open, wasCreateVisitNowChecked, reset]);

  const handleDuplicateModalClose = async (action: "open" | "create" | "cancel") => {
    setDuplicateModalOpen(false);
    if (action === "open" && duplicateCandidates.length > 0) {
      // User wants to view existing patient - navigate and close
      navigate(`${AppRoutes.PATIENTS}/${duplicateCandidates[0].id}`);
      handleClose();
    } else if (action === "create") {
      // User wants to create anyway - proceed with patient creation
      const values = watch();
      await onSubmitPatient(values as QuickRegisterFormValues);
    } else {
      // Cancel - close modal
      handleClose();
    }
  };

  const handleAppointmentCreated = () => {
    setAppointmentDialogOpen(false);
    if (createdPatientId) {
      showSuccess(
        t("appointments.createSuccessWithDetails", {
          defaultValue: "Appointment created: {{name}} • {{datetime}}",
          name: createdPatientName,
          datetime: new Date().toLocaleString(),
        })
      );
      navigate(`${AppRoutes.PATIENTS}/${createdPatientId}`);
      onCreated();
      handleClose();
    }
  };

  const handleAdmissionCreated = () => {
    setAdmissionDialogOpen(false);
    if (createdPatientId) {
      showSuccess(
        t("admissions.createSuccessWithDetails", {
          defaultValue: "Admission created: {{name}}",
          name: createdPatientName,
        })
      );
      navigate(`${AppRoutes.PATIENTS}/${createdPatientId}`);
      onCreated();
      handleClose();
    }
  };

  const getStepNumber = () => {
    if (currentStep === "patient") return 0;
    if (currentStep === "visitType") return 1;
    if (currentStep === "appointment" || currentStep === "admission") return 2;
    return 0;
  };

  return (
    <>
      <Dialog open={open && currentStep !== "appointment" && currentStep !== "admission"} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {currentStep !== "patient" && (
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={handleBack}
                size="small"
                sx={{ minWidth: "auto", mr: 1 }}
              >
                {t("common.back", { defaultValue: "Back" })}
              </Button>
            )}
            {t("patients.quickRegister", { defaultValue: "Quick Register Patient" })}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {/* Stepper */}
            {createVisitNow && (
              <Stepper activeStep={getStepNumber()} sx={{ mb: 3 }}>
                <Step>
                  <StepLabel>{t("patients.stepPatient", { defaultValue: "Patient" })}</StepLabel>
                </Step>
                <Step>
                  <StepLabel>{t("patients.stepVisitType", { defaultValue: "Visit Type" })}</StepLabel>
                </Step>
                <Step>
                  <StepLabel>
                    {currentStep === "appointment"
                      ? t("patients.stepAppointment", { defaultValue: "Appointment" })
                      : t("patients.stepAdmission", { defaultValue: "Admission" })}
                  </StepLabel>
                </Step>
              </Stepper>
            )}

            {/* Step 1: Patient Form */}
            {currentStep === "patient" && (
              <Box>
                {/* Show message if patient already created */}
                {createdPatientId && (
                  <Alert severity="success" sx={{ mb: 3 }}>
                    {t("patients.patientCreatedContinue", {
                      defaultValue: "Patient has been created successfully. Click 'Next' to create an appointment or admission.",
                    })}
                  </Alert>
                )}
                <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label={t("patients.firstName", { defaultValue: "First Name" })}
                    fullWidth
                    required
                    disabled={!!createdPatientId}
                    {...register("first_name", {
                      onBlur: () => trigger("first_name"),
                    })}
                    error={!!errors.first_name}
                    helperText={errors.first_name?.message}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label={t("patients.lastName", { defaultValue: "Last Name" })}
                    fullWidth
                    disabled={!!createdPatientId}
                    {...register("last_name", {
                      onBlur: () => trigger("last_name"),
                    })}
                    error={!!errors.last_name}
                    helperText={errors.last_name?.message}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        {...register("dob_unknown")}
                        checked={dobUnknown}
                        disabled={!!createdPatientId}
                        onChange={(e) => {
                          register("dob_unknown").onChange(e);
                          if (e.target.checked) {
                            // Clear DOB when unknown is checked
                            const dobField = document.querySelector('input[name="dob"]') as HTMLInputElement;
                            if (dobField) dobField.value = "";
                          }
                        }}
                      />
                    }
                    label={t("patients.dobUnknown", {
                      defaultValue: "DOB unknown",
                    })}
                  />
                </Grid>

                {!dobUnknown ? (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                      name="dob"
                      control={control}
                      rules={{ required: !dobUnknown ? "Date of birth is required" : false }}
                      render={({ field }) => (
                        <TextField
                          label={t("patients.dateOfBirth", {
                            defaultValue: "Date of Birth",
                          })}
                          type="date"
                          fullWidth
                          required
                          InputLabelProps={{ shrink: true }}
                          inputProps={{ max: new Date().toISOString().split("T")[0] }}
                          error={!!errors.dob}
                          helperText={errors.dob?.message}
                          disabled={!!createdPatientId || dobUnknown}
                          {...field}
                          value={field.value ? new Date(field.value).toISOString().split("T")[0] : ""}
                          onChange={(e) => {
                            const dateValue = e.target.value ? new Date(e.target.value) : null;
                            field.onChange(dateValue);
                          }}
                        />
                      )}
                    />
                  </Grid>
                ) : (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label={t("patients.age", { defaultValue: "Age (Optional)" })}
                      type="number"
                      fullWidth
                      disabled={!!createdPatientId}
                      {...register("age_only", { valueAsNumber: true })}
                      error={!!errors.age_only}
                      helperText={
                        errors.age_only?.message ||
                        t("patients.ageOptional", { defaultValue: "Optional if DOB unknown" })
                      }
                    />
                  </Grid>
                )}

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller
                    name="gender"
                    control={control}
                    rules={{ required: "Gender is required" }}
                    render={({ field }) => (
                      <TextField
                        select
                        label={t("patients.gender", { defaultValue: "Gender" })}
                        fullWidth
                        required
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={field.onBlur}
                        error={!!errors.gender}
                        helperText={errors.gender?.message}
                        disabled={!!createdPatientId}
                        SelectProps={{
                          displayEmpty: false,
                          renderValue: (value) => {
                            if (!value || value === "") return "";
                            const genderMap: Record<string, string> = {
                              MALE: t("patients.genderMale", { defaultValue: "Male" }),
                              FEMALE: t("patients.genderFemale", { defaultValue: "Female" }),
                              OTHER: t("patients.genderOther", { defaultValue: "Other" }),
                              UNKNOWN: t("patients.genderUnknown", { defaultValue: "Unknown" }),
                            };
                            return genderMap[value as string] || "";
                          },
                        }}
                      >
                        <MenuItem value="MALE">
                          {t("patients.genderMale", { defaultValue: "Male" })}
                        </MenuItem>
                        <MenuItem value="FEMALE">
                          {t("patients.genderFemale", { defaultValue: "Female" })}
                        </MenuItem>
                        <MenuItem value="OTHER">
                          {t("patients.genderOther", { defaultValue: "Other" })}
                        </MenuItem>
                        <MenuItem value="UNKNOWN">
                          {t("patients.genderUnknown", { defaultValue: "Unknown" })}
                        </MenuItem>
                      </TextField>
                    )}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label={t("patients.phonePrimary", {
                      defaultValue: "Primary Phone",
                    })}
                    disabled={!!createdPatientId}
                    fullWidth
                    required
                    {...register("phone_primary", {
                      onBlur: async () => {
                        await trigger("phone_primary");
                        await checkPhoneDuplicate(watch("phone_primary"));
                      },
                    })}
                    error={!!errors.phone_primary}
                    helperText={
                      errors.phone_primary?.message ||
                      t("patients.phoneHelper", {
                        defaultValue: "Used for appointment SMS",
                      })
                    }
                  />
                  {phoneWarning && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      {phoneWarning}
                    </Alert>
                  )}
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label={t("patients.email", { defaultValue: "Email" })}
                    type="email"
                    fullWidth
                    disabled={!!createdPatientId}
                    {...register("email")}
                    error={!!errors.email}
                    helperText={errors.email?.message}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label={t("patients.city", { defaultValue: "City" })}
                    fullWidth
                    required
                    disabled={!!createdPatientId}
                    {...register("city")}
                    error={!!errors.city}
                    helperText={errors.city?.message}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControlLabel
                    control={
                      <Checkbox 
                        {...register("create_visit_now")} 
                        defaultChecked
                        disabled={!!createdPatientId}
                      />
                    }
                    label={t("patients.createVisitNow", {
                      defaultValue: "Create visit now (OPD/IPD)",
                    })}
                  />
                </Grid>
              </Grid>
              </Box>
            )}

            {/* Step 2: Visit Type Selection */}
            {currentStep === "visitType" && (
              <Box>
                <Typography variant="body1" sx={{ mb: 3 }}>
                  {t("patients.selectVisitTypeDescription", {
                    defaultValue: "Choose the type of visit for this patient:",
                  })}
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Button
                      variant="outlined"
                      size="large"
                      fullWidth
                      onClick={() => handleVisitTypeSelect("OPD")}
                      sx={{ py: 3 }}
                    >
                      <Box>
                        <Typography variant="h6">
                          {t("patients.opd", { defaultValue: "OPD" })}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t("patients.opdDescription", {
                            defaultValue: "Outpatient Department",
                          })}
                        </Typography>
                      </Box>
                    </Button>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Button
                      variant="outlined"
                      size="large"
                      fullWidth
                      onClick={() => handleVisitTypeSelect("IPD")}
                      sx={{ py: 3 }}
                    >
                      <Box>
                        <Typography variant="h6">
                          {t("patients.ipd", { defaultValue: "IPD" })}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t("patients.ipdDescription", {
                            defaultValue: "Inpatient Department",
                          })}
                        </Typography>
                      </Box>
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ pr: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={isSubmitting}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          {currentStep === "patient" && (
            <>
              {createdPatientId && wasCreateVisitNowChecked ? (
                <Button
                  onClick={() => setCurrentStep("visitType")}
                  variant="contained"
                >
                  {t("common.next", { defaultValue: "Next" })}
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit(onSubmitPatient)}
                  variant="contained"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? t("common.creating", { defaultValue: "Creating..." })
                    : t("patients.createPatient", {
                        defaultValue: "Create Patient",
                      })}
                </Button>
              )}
            </>
          )}
          {currentStep === "visitType" && (
            <Button onClick={handleClose} variant="outlined">
              {t("common.skip", { defaultValue: "Skip" })}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <DuplicateDetectionModal
        open={duplicateModalOpen}
        candidates={duplicateCandidates}
        onClose={handleDuplicateModalClose}
        createdPatientId={createdPatientId}
      />

      {/* Appointment Dialog (for OPD) */}
      {createdPatientId && (
        <AppointmentFormDialog
          open={appointmentDialogOpen}
          onClose={() => {
            setAppointmentDialogOpen(false);
            setCurrentStep("visitType");
          }}
          onCreated={handleAppointmentCreated}
          initialPatientId={createdPatientId}
        />
      )}

      {/* Admission Dialog (for IPD) */}
      {createdPatientId && (
        <AdmissionFormDialog
          open={admissionDialogOpen}
          onClose={() => {
            setAdmissionDialogOpen(false);
            setCurrentStep("visitType");
          }}
          onCreated={handleAdmissionCreated}
          initialPatientId={createdPatientId}
        />
      )}
    </>
  );
};

export default QuickRegisterDialog;
