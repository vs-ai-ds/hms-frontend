// src/app/components/patients/PatientMiniCard.tsx
import React from "react";
import {
  Paper,
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Alert,
} from "@mui/material";
import {
  OpenInNew as OpenInNewIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { AppRoutes } from "@app/routes";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@app/lib/apiClient";

interface Patient {
  id: string;
  patient_code?: string | null;
  first_name: string;
  last_name?: string | null;
  middle_name?: string | null;
  phone_primary?: string | null;
  dob?: string | null;
  gender?: string | null;
  patient_type?: "OPD" | "IPD";
  is_deceased?: boolean;
  date_of_death?: string | null;
}

interface PatientMiniCardProps {
  patientId: string;
  showWarning?: boolean;
}

const calculateAge = (dob: string | null): number | null => {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
};

const formatDisplayName = (patient: Patient): string => {
  const parts = [patient.first_name];
  if (patient.middle_name) parts.push(patient.middle_name);
  if (patient.last_name) parts.push(patient.last_name);
  return parts.join(" ");
};

const PatientMiniCard: React.FC<PatientMiniCardProps> = ({
  patientId,
  showWarning = true,
}) => {
  const { t } = useTranslation();

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: async () => {
      const res = await apiClient.get(`/patients/${patientId}`);
      return res.data;
    },
    enabled: !!patientId,
  });

  // Check for active admission
  const { data: activeAdmissions } = useQuery({
    queryKey: ["admissions", "active", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      try {
        const res = await apiClient.get("/admissions", {
          params: { patient_id: patientId, status: "ACTIVE" },
        });
        return res.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!patientId,
  });

  const hasActiveAdmission = activeAdmissions && activeAdmissions.length > 0;

  if (isLoading || !patient) {
    return null;
  }

  const age = calculateAge(patient.dob);
  const displayName = formatDisplayName(patient);
  const isDeceased = patient.is_deceased || false;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box flex={1}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Typography variant="subtitle1" fontWeight={600}>
              {displayName}
            </Typography>
            {patient.patient_code && (
              <Chip label={patient.patient_code} size="small" variant="outlined" />
            )}
            {isDeceased && (
              <Chip
                label={t("patients.deceased", { defaultValue: "DECEASED" })}
                color="error"
                size="small"
              />
            )}
            {hasActiveAdmission && (
              <Chip label="IPD" color="primary" size="small" />
            )}
          </Box>
          <Typography variant="body2" color="text.secondary">
            {age !== null && `${age} yrs`}
            {patient.gender && ` • ${patient.gender}`}
            {patient.phone_primary && ` • ${patient.phone_primary}`}
          </Typography>
        </Box>
        <Tooltip title={t("patients.openFullProfile", { defaultValue: "Open full patient profile" })}>
          <IconButton
            size="small"
            onClick={() => window.open(`${AppRoutes.PATIENTS}/${patient.id}`, "_blank")}
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      {showWarning && isDeceased && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {t("patients.deceasedWarning", {
            defaultValue: "This patient is deceased. No new encounters or prescriptions can be created.",
          })}
        </Alert>
      )}
      {showWarning && hasActiveAdmission && (
        <Alert severity="info" sx={{ mt: 1 }}>
          {t("patients.activeAdmissionWarning", {
            defaultValue: "Patient has an active admission. OPD appointments are blocked.",
          })}
        </Alert>
      )}
    </Paper>
  );
};

export default PatientMiniCard;
