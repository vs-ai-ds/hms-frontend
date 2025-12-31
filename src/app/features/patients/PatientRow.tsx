// src/app/features/patients/PatientRow.tsx
import React from "react";
import {
  TableRow,
  TableCell,
  Typography,
  Chip,
  Box,
  IconButton,
  Tooltip as MuiTooltip,
} from "@mui/material";
import {
  Visibility as ViewIcon,
  CalendarToday as CalendarIcon,
  LocalHospital as HospitalIcon,
  EditNote as PrescriptionIcon,
} from "@mui/icons-material";
import { TFunction } from "i18next";
import { canWriteRx } from "@app/lib/utils/appointmentEligibility";
import { useAuthStore } from "@app/store/authStore";
import { can } from "@app/lib/abac";
import { formatDate } from "@app/lib/dateFormat";

interface Patient {
  id: string;
  patient_code?: string | null;
  first_name: string;
  last_name?: string | null;
  middle_name?: string | null;
  phone_primary?: string | null;
  phone?: string | null;
  city?: string | null;
  patient_type: "OPD" | "IPD";
  dob?: string | null;
  is_deceased?: boolean;
  date_of_death?: string | null;
  created_at: string;
  last_visited_at?: string | null;
  // Visit flags (optional, included when include=visit_flags)
  has_active_admission?: boolean | null;
  next_eligible_opd_appointment_at?: string | null;
}

interface PatientRowProps {
  patient: Patient;
  age: number | null;
  displayName: string;
  onView: () => void;
  onCreateOPD: () => void;
  onAdmit: () => void;
  onWritePrescription: () => void;
  t: TFunction;
  showError: (message: string) => void;
}

const maskPhone = (phone: string | null | undefined): string => {
  if (!phone) return "-";
  if (phone.length > 4) {
    return `****${phone.slice(-4)}`;
  }
  return phone;
};

const PatientRow: React.FC<PatientRowProps> = ({
  patient,
  age,
  displayName,
  onView,
  onCreateOPD,
  onAdmit,
  onWritePrescription,
  t,
  showError,
}) => {
  // Use visit flags from patient data (computed in batch on backend)
  const hasActiveAdmission = patient.has_active_admission === true;
  const nextEligibleOPDAt = patient.next_eligible_opd_appointment_at
    ? new Date(patient.next_eligible_opd_appointment_at)
    : null;
  
  const { user } = useAuthStore();
  const hasPrescriptionPermission = can(user, "prescriptions:create");

  const isDeceased = patient.is_deceased || false;
  const canCreateOPD = !isDeceased && !hasActiveAdmission;
  const canAdmit = !isDeceased && !hasActiveAdmission;
  
  // Rx icon should only show if user has permission AND (eligible OPD exists OR active IPD admission exists OR walk-in allowed)
  const hasEligibleOPD = nextEligibleOPDAt !== null;
  const canShowRxIcon = canWriteRx(
    hasPrescriptionPermission,
    hasEligibleOPD ? 1 : 0, // Count of eligible OPD appointments
    hasActiveAdmission,
    true // Allow walk-in
  );
  const canWritePrescription = !isDeceased && canShowRxIcon;

  const handleCreateOPD = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeceased) {
      showError(
        t("patients.deceasedCannotCreateAppointment", {
          defaultValue: "Cannot create appointment for deceased patient",
        })
      );
      return;
    }
    if (hasActiveAdmission) {
      showError(
        t("appointments.activeAdmissionBlocked", {
          defaultValue: "Cannot create OPD appointment for patient with active admission. Please discharge the patient first.",
        })
      );
      return;
    }
    onCreateOPD();
  };

  const handleAdmit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeceased) {
      showError(
        t("patients.deceasedCannotAdmit", {
          defaultValue: "Cannot admit deceased patient",
        })
      );
      return;
    }
    if (hasActiveAdmission) {
      showError(
        t("admissions.activeAdmissionExists", {
          defaultValue: "Patient is already admitted. Please discharge the current admission first.",
        })
      );
      return;
    }
    onAdmit();
  };

  const handleWritePrescription = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeceased) {
      showError(
        t("patients.deceasedCannotPrescribe", {
          defaultValue: "Cannot write prescription for deceased patient",
        })
      );
      return;
    }
    onWritePrescription();
  };

  // Compute status chips
  const statusChips = [];
  if (isDeceased) {
    statusChips.push(
      <Chip
        key="deceased"
        label={t("patients.deceased", { defaultValue: "DECEASED" })}
        color="error"
        size="small"
        sx={{ ml: 0.5 }}
      />
    );
  }
  
  // Show IPD Active if has active admission
  if (hasActiveAdmission) {
    statusChips.push(
      <Chip
        key="ipd-active"
        label={t("patients.ipd", { defaultValue: "IPD" })}
        color="primary"
        size="small"
        sx={{ ml: 0.5 }}
      />
    );
  }
  
  // Show Next OPD if has eligible OPD appointment
  if (nextEligibleOPDAt) {
    const formattedDate = formatDate(nextEligibleOPDAt, true);
    statusChips.push(
      <Chip
        key="next-opd"
        label={`${t("patients.nextOpd", { defaultValue: "Next OPD" })}: ${formattedDate}`}
        color="info"
        size="small"
        sx={{ ml: 0.5 }}
      />
    );
  }
  
  // Add tooltip warning if both IPD and OPD exist
  const hasBoth = hasActiveAdmission && nextEligibleOPDAt;
  const chipsWrapper = hasBoth ? (
    <MuiTooltip 
      title={t("patients.ipdAndOpdWarning", { 
        defaultValue: "Patient is admitted; OPD appointment should be rescheduled/cancelled." 
      })} 
      arrow
    >
      <Box sx={{ display: "inline-flex", alignItems: "center" }}>
        {statusChips}
      </Box>
    </MuiTooltip>
  ) : (
    <Box sx={{ display: "inline-flex", alignItems: "center" }}>
      {statusChips}
    </Box>
  );

  return (
    <TableRow
      hover
      sx={{ cursor: "pointer" }}
      onClick={onView}
    >
      <TableCell>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="body2" fontWeight={500}>
            {displayName}
          </Typography>
          {chipsWrapper}
        </Box>
      </TableCell>
      <TableCell>
        {patient.patient_code ? (
          <Chip label={patient.patient_code} size="small" variant="outlined" />
        ) : (
          "-"
        )}
      </TableCell>
      <TableCell>
        {age !== null ? `${age} yrs` : "-"}
      </TableCell>
      <TableCell>{maskPhone(patient.phone_primary || patient.phone)}</TableCell>
      <TableCell>{patient.city || "-"}</TableCell>
      <TableCell>
        {patient.last_visited_at
          ? formatDate(patient.last_visited_at)
          : formatDate(patient.created_at)}
      </TableCell>
      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
        <Box display="flex" gap={0.5} justifyContent="center">
          <MuiTooltip title={t("patients.viewDetails", { defaultValue: "View patient details" })}>
            <IconButton size="small" onClick={onView}>
              <ViewIcon fontSize="small" />
            </IconButton>
          </MuiTooltip>
          <MuiTooltip
            title={
              isDeceased
                ? t("patients.actionDisabledDeceased", { defaultValue: "Action disabled for deceased patient" })
                : hasActiveAdmission
                ? t("appointments.activeAdmissionBlocked", {
                    defaultValue: "Cannot create OPD appointment for patient with active admission. Please discharge the patient first.",
                  })
                : t("patients.createOPDAppointment", { defaultValue: "Create OPD appointment" })
            }
          >
            <span>
              <IconButton
                size="small"
                onClick={handleCreateOPD}
                disabled={!canCreateOPD}
              >
                <CalendarIcon fontSize="small" />
              </IconButton>
            </span>
          </MuiTooltip>
          <MuiTooltip
            title={
              isDeceased
                ? t("patients.actionDisabledDeceased", { defaultValue: "Action disabled for deceased patient" })
                : hasActiveAdmission
                ? t("admissions.activeAdmissionExists", {
                    defaultValue: "Patient is already admitted. Please discharge the current admission first.",
                  })
                : t("patients.admit", { defaultValue: "Admit patient (IPD)" })
            }
          >
            <span>
              <IconButton
                size="small"
                onClick={handleAdmit}
                disabled={!canAdmit}
              >
                <HospitalIcon fontSize="small" />
              </IconButton>
            </span>
          </MuiTooltip>
          <MuiTooltip
            title={
              isDeceased
                ? t("patients.actionDisabledDeceased", { defaultValue: "Action disabled for deceased patient" })
                : t("patients.writePrescription", { defaultValue: "Write prescription" })
            }
          >
            <span>
              <IconButton
                size="small"
                onClick={handleWritePrescription}
                disabled={!canWritePrescription}
              >
                <PrescriptionIcon fontSize="small" />
              </IconButton>
            </span>
          </MuiTooltip>
        </Box>
      </TableCell>
    </TableRow>
  );
};

export default PatientRow;
