// src/app/components/appointments/AppointmentDetailDialog.tsx
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Paper,
  Divider,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  Grid,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { getAppointment } from "@app/lib/api/appointments";
import { apiClient } from "@app/lib/apiClient";
import { useTranslation } from "react-i18next";
import { getAppointmentStatusLabel, getAppointmentStatusColor, getPrescriptionStatusLabel, getPrescriptionStatusColor } from "@app/lib/utils/statusUtils";

interface AppointmentDetailDialogProps {
  open: boolean;
  appointmentId: string | null;
  onClose: () => void;
  onViewPrescription?: (prescriptionId: string) => void; // Callback when "View Prescription" is clicked
}

// Helper function to format appointment ID
const formatAppointmentId = (appointment: any): string => {
  if (!appointment?.id) return "";
  const isIPD = appointment.linked_ipd_admission_id;
  const prefix = isIPD ? "IPD" : "OPD";
  // Extract first 8 chars of tenant ID from patient code if available, otherwise use first 8 of appointment ID
  const tenantPrefix = appointment.patient_code?.split("-")[0] || appointment.id.replace(/-/g, "").substring(0, 8);
  // Use a simple sequence number based on appointment ID hash or use last part of ID
  const seq = appointment.id.replace(/-/g, "").substring(8, 12) || "00001";
  return `${tenantPrefix}-${prefix}-${seq.padStart(5, "0")}`;
};

const AppointmentDetailDialog: React.FC<AppointmentDetailDialogProps> = ({
  open,
  appointmentId,
  onClose,
  onViewPrescription,
}) => {
  const { t } = useTranslation();

  // Fetch appointment detail
  const { data: appointmentDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["appointment", appointmentId],
    queryFn: () => (appointmentId ? getAppointment(appointmentId) : null),
    enabled: !!appointmentId && open,
  });

  // Fetch patient data for appointment detail
  const { data: appointmentPatient } = useQuery({
    queryKey: ["patient", appointmentDetail?.patient_id],
    queryFn: async () => {
      if (!appointmentDetail?.patient_id) return null;
      const res = await apiClient.get(`/patients/${appointmentDetail.patient_id}`);
      return res.data;
    },
    enabled: !!appointmentDetail?.patient_id && open,
  });

  // Fetch prescriptions for appointment detail (always fetch)
  const { data: appointmentPrescriptions } = useQuery({
    queryKey: ["prescriptions", "appointment", appointmentDetail?.id],
    queryFn: async () => {
      if (!appointmentDetail?.id) return [];
      const res = await apiClient.get("/prescriptions", {
        params: { appointment_id: appointmentDetail.id },
      });
      return res.data?.items || res.data || [];
    },
    enabled: !!appointmentDetail?.id && open,
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h6">
            {t("appointments.details", { defaultValue: "Appointment Details" })}
            {appointmentDetail?.id && (
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                (ID: {formatAppointmentId(appointmentDetail)})
              </Typography>
            )}
          </Typography>
          <IconButton onClick={onClose} size="large">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {detailLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : !appointmentDetail ? (
          <Alert severity="error">
            {t("common.loadError", { defaultValue: "Unable to load appointment details." })}
          </Alert>
        ) : (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {t("appointments.patientInfo", { defaultValue: "Patient Information" })}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t("appointments.patient", { defaultValue: "Patient" })}
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {appointmentDetail.patient_name || "-"}
                      {appointmentDetail.patient_code && (
                        <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                          ({appointmentDetail.patient_code})
                        </Typography>
                      )}
                    </Typography>
                  </Grid>
                  {appointmentPatient?.gender && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t("patients.gender", { defaultValue: "Gender" })}
                      </Typography>
                      <Typography variant="body1">
                        {appointmentPatient.gender.charAt(0).toUpperCase() + appointmentPatient.gender.slice(1).toLowerCase()}
                      </Typography>
                    </Grid>
                  )}
                  {appointmentPatient && (
                    <>
                      {(appointmentPatient.phone_primary || appointmentPatient.email) && (
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant="caption" color="text.secondary">
                            {t("patients.contact", { defaultValue: "Contact" })}
                          </Typography>
                          <Typography variant="body1">
                            {appointmentPatient.phone_primary && (
                              <>
                                {t("patients.phone", { defaultValue: "Phone" })}: {appointmentPatient.phone_primary}
                              </>
                            )}
                            {appointmentPatient.phone_primary && appointmentPatient.email && " • "}
                            {appointmentPatient.email && (
                              <>
                                {t("patients.email", { defaultValue: "Email" })}: {appointmentPatient.email}
                              </>
                            )}
                          </Typography>
                        </Grid>
                      )}
                      {(appointmentPatient.city || appointmentPatient.state) && (
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant="caption" color="text.secondary">
                            {t("patients.address", { defaultValue: "Address" })}
                          </Typography>
                          <Typography variant="body1">
                            {appointmentPatient.state
                              ? `${appointmentPatient.city || ""}, ${appointmentPatient.state}`.replace(/^,\s*|,\s*$/g, '')
                              : appointmentPatient.city || "-"}
                          </Typography>
                        </Grid>
                      )}
                    </>
                  )}
                </Grid>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {t("appointments.appointmentInfo", { defaultValue: "Appointment Information" })}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t("appointments.doctor", { defaultValue: "Doctor" })}
                    </Typography>
                    <Typography variant="body1">{appointmentDetail.doctor_name || "-"}</Typography>
                  </Grid>
                  {appointmentDetail.department && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t("appointments.department", { defaultValue: "Department" })}
                      </Typography>
                      <Typography variant="body1">{appointmentDetail.department}</Typography>
                    </Grid>
                  )}
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t("appointments.scheduledAt", { defaultValue: "Scheduled At" })}
                    </Typography>
                    <Typography variant="body1">
                      {appointmentDetail.scheduled_at
                        ? new Date(appointmentDetail.scheduled_at).toLocaleString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : "-"}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t("appointments.status", { defaultValue: "Status" })}
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip
                        label={getAppointmentStatusLabel(appointmentDetail.status)}
                        size="small"
                        color={getAppointmentStatusColor(appointmentDetail.status)}
                        sx={{ borderRadius: 2 }}
                      />
                    </Box>
                  </Grid>
                  {appointmentDetail.notes && (
                    <Grid size={{ xs: 12 }}>
                      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                        {t("appointments.notes", { defaultValue: "Notes" })}
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {appointmentDetail.notes}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </Grid>

            {/* Prescription Section - Always show if prescriptions exist */}
            {appointmentPrescriptions && appointmentPrescriptions.length > 0 && (
              <Grid size={{ xs: 12 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    {t("appointments.prescription", { defaultValue: "Prescription(s)" })}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {appointmentPrescriptions.map((prescription: any, idx: number) => (
                      <Box key={prescription.id}>
                        <Typography variant="body2" sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                          <span>{idx + 1}. <strong>Prescription Id:</strong> {prescription.prescription_code || prescription.id.substring(0, 8)}</span>
                          <span style={{ margin: "0 8px" }}>•</span>
                          <span><strong>Status:</strong>{" "}
                            <Chip
                              label={getPrescriptionStatusLabel(prescription.status)}
                              size="small"
                              color={getPrescriptionStatusColor(prescription.status)}
                              sx={{ borderRadius: 2, height: 20, fontSize: "0.7rem" }}
                            />
                          </span>
                          <span style={{ margin: "0 8px" }}>•</span>
                          <Button
                            variant="text"
                            size="small"
                            sx={{ textTransform: "none", minWidth: "auto", p: 0, fontSize: "0.875rem" }}
                            onClick={() => {
                              if (onViewPrescription) {
                                onViewPrescription(prescription.id);
                              }
                            }}
                          >
                            {t("appointments.viewPrescription", { defaultValue: "View Prescription" })}
                          </Button>
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Paper>
              </Grid>
            )}

            {/* IPD Admission Badge */}
            {appointmentDetail.linked_ipd_admission_id && (
              <Grid size={{ xs: 12 }}>
                <Alert severity="info">
                  {t("appointments.linkedToIpdAdmission", { defaultValue: "This appointment is linked to an IPD admission." })}
                </Alert>
              </Grid>
            )}

            {/* Audit Information & Metadata */}
            {(appointmentDetail.cancelled_reason || appointmentDetail.cancelled_note || appointmentDetail.checked_in_at || appointmentDetail.consultation_started_at || appointmentDetail.completed_at || appointmentDetail.no_show_at || appointmentDetail.created_at) && (
              <Grid size={{ xs: 12 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    {t("appointments.auditInfo", { defaultValue: "Audit Information & Metadata" })}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    {appointmentDetail.checked_in_at && (
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t("appointments.checkedInAt", { defaultValue: "Checked In At" })}
                        </Typography>
                        <Typography variant="body2">
                          {new Date(appointmentDetail.checked_in_at).toLocaleString()}
                        </Typography>
                      </Grid>
                    )}
                    {appointmentDetail.consultation_started_at && (
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t("appointments.consultationStartedAt", { defaultValue: "Consultation Started At" })}
                        </Typography>
                        <Typography variant="body2">
                          {new Date(appointmentDetail.consultation_started_at).toLocaleString()}
                        </Typography>
                      </Grid>
                    )}
                    {appointmentDetail.completed_at && (
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t("appointments.completedAt", { defaultValue: "Completed At" })}
                        </Typography>
                        <Typography variant="body2">
                          {new Date(appointmentDetail.completed_at).toLocaleString()}
                        </Typography>
                      </Grid>
                    )}
                    {appointmentDetail.no_show_at && (
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t("appointments.noShowAt", { defaultValue: "No-Show At" })}
                        </Typography>
                        <Typography variant="body2">
                          {new Date(appointmentDetail.no_show_at).toLocaleString()}
                        </Typography>
                      </Grid>
                    )}
                    {appointmentDetail.created_at && (
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t("appointments.createdAt", { defaultValue: "Created At" })}
                        </Typography>
                        <Typography variant="body2">
                          {new Date(appointmentDetail.created_at).toLocaleString()}
                        </Typography>
                      </Grid>
                    )}
                    {appointmentDetail.cancelled_reason && (
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t("appointments.cancellationReason", { defaultValue: "Cancellation Reason" })}
                        </Typography>
                        <Typography variant="body2">{appointmentDetail.cancelled_reason}</Typography>
                      </Grid>
                    )}
                    {appointmentDetail.cancelled_note && (
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t("appointments.cancellationNote", { defaultValue: "Cancellation Note" })}
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                          {appointmentDetail.cancelled_note}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              </Grid>
            )}
          </Grid>
        )}
      </DialogContent>

      <DialogActions sx={{ pr: 3, pb: 2 }}>
        <Button onClick={onClose}>
          {t("common.close", { defaultValue: "Close" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AppointmentDetailDialog;

