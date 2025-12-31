// src/app/components/patients/ClinicalSnapshotPanel.tsx
import React from "react";
import {
  Paper,
  Box,
  Typography,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  ExpandMore as ExpandMoreIcon,
  LocalHospital as HospitalIcon,
  CalendarToday as CalendarIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@app/lib/apiClient";

interface ClinicalSnapshotPanelProps {
  patientId: string;
  variant?: "panel" | "accordion";
}

const ClinicalSnapshotPanel: React.FC<ClinicalSnapshotPanelProps> = ({
  patientId,
  variant = "panel",
}) => {
  const { t } = useTranslation();

  const { data: snapshot, isLoading } = useQuery({
    queryKey: ["patient", patientId, "clinical-snapshot"],
    queryFn: async () => {
      const res = await apiClient.get(`/patients/${patientId}/clinical-snapshot`);
      return res.data;
    },
    enabled: !!patientId,
  });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!snapshot) {
    return null;
  }

  const content = (
    <Box>
      {/* Allergies */}
      {snapshot.allergies && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} mb={1}>
            {t("patients.knownAllergies", { defaultValue: "Known Allergies" })}
          </Typography>
          <Typography variant="body2">{snapshot.allergies}</Typography>
        </Box>
      )}

      {/* Chronic Conditions */}
      {snapshot.chronic_conditions && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} mb={1}>
            {t("patients.chronicConditions", { defaultValue: "Chronic Conditions" })}
          </Typography>
          <Typography variant="body2">{snapshot.chronic_conditions}</Typography>
        </Box>
      )}

      {/* Latest Vitals */}
      {snapshot.latest_vital && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} mb={1}>
            {t("vitals.latestVitals", { defaultValue: "Latest Vitals" })}
          </Typography>
          <Grid container spacing={1}>
            {snapshot.latest_vital.systolic_bp !== null && snapshot.latest_vital.diastolic_bp !== null && (
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">
                  {t("vitals.bloodPressure", { defaultValue: "BP" })}
                </Typography>
                <Typography variant="body2">
                  {snapshot.latest_vital.systolic_bp}/{snapshot.latest_vital.diastolic_bp} mmHg
                </Typography>
              </Grid>
            )}
            {snapshot.latest_vital.heart_rate !== null && (
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">
                  {t("vitals.heartRate", { defaultValue: "HR" })}
                </Typography>
                <Typography variant="body2">{snapshot.latest_vital.heart_rate} bpm</Typography>
              </Grid>
            )}
            {snapshot.latest_vital.temperature_c !== null && (
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">
                  {t("vitals.temperature", { defaultValue: "Temp" })}
                </Typography>
                <Typography variant="body2">
                  {((snapshot.latest_vital.temperature_c * 9) / 5 + 32).toFixed(1)}°F
                </Typography>
              </Grid>
            )}
            {snapshot.latest_vital.weight_kg !== null && (
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">
                  {t("vitals.weight", { defaultValue: "Weight" })}
                </Typography>
                <Typography variant="body2">{snapshot.latest_vital.weight_kg} kg</Typography>
              </Grid>
            )}
            {snapshot.latest_vital.height_cm !== null && (
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary">
                  {t("vitals.height", { defaultValue: "Height" })}
                </Typography>
                <Typography variant="body2">{snapshot.latest_vital.height_cm} cm</Typography>
              </Grid>
            )}
            {snapshot.latest_vital.recorded_at && (
              <Grid size={{ xs: 12 }}>
                <Typography variant="caption" color="text.secondary">
                  {t("vitals.recordedAt", { defaultValue: "Recorded" })}:{" "}
                  {new Date(snapshot.latest_vital.recorded_at).toLocaleString()}
                </Typography>
              </Grid>
            )}
          </Grid>
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Active Admission or Next Appointment */}
      {snapshot.active_admission ? (
        <Box>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <HospitalIcon fontSize="small" color="primary" />
            <Typography variant="subtitle2" fontWeight={600}>
              {t("patients.activeIPDAdmission", { defaultValue: "Active IPD Admission" })}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {t("admissions.admittedSince", { defaultValue: "Admitted since" })}:{" "}
            {new Date(snapshot.active_admission.admit_datetime).toLocaleString()}
          </Typography>
          {snapshot.active_admission.department && (
            <Typography variant="body2" color="text.secondary">
              {t("admissions.department", { defaultValue: "Department" })}: {snapshot.active_admission.department}
            </Typography>
          )}
          {snapshot.active_admission.primary_doctor_name && (
            <Typography variant="body2" color="text.secondary">
              {t("admissions.primaryDoctor", { defaultValue: "Primary Doctor" })}: {snapshot.active_admission.primary_doctor_name}
            </Typography>
          )}
        </Box>
      ) : snapshot.next_appointment ? (
        <Box>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <CalendarIcon fontSize="small" color="primary" />
            <Typography variant="subtitle2" fontWeight={600}>
              {t("patients.nextOPDAppointment", { defaultValue: "Next OPD Appointment" })}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {t("appointments.scheduledAt", { defaultValue: "Scheduled" })}:{" "}
            {new Date(snapshot.next_appointment.scheduled_at).toLocaleString()}
          </Typography>
          {snapshot.next_appointment.department && (
            <Typography variant="body2" color="text.secondary">
              {t("appointments.department", { defaultValue: "Department" })}: {snapshot.next_appointment.department}
            </Typography>
          )}
          {snapshot.next_appointment.doctor_name && (
            <Typography variant="body2" color="text.secondary">
              {t("appointments.doctor", { defaultValue: "Doctor" })}: {snapshot.next_appointment.doctor_name}
            </Typography>
          )}
        </Box>
      ) : null}
    </Box>
  );

  if (variant === "accordion") {
    return (
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" fontWeight={600}>
            {t("patients.clinicalSnapshot", { defaultValue: "Clinical Snapshot" })}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>{content}</AccordionDetails>
      </Accordion>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" fontWeight={600} mb={2}>
        {t("patients.clinicalSnapshot", { defaultValue: "Clinical Snapshot" })}
      </Typography>
      {content}
    </Paper>
  );
};

export default ClinicalSnapshotPanel;
