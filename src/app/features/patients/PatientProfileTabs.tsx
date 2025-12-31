// src/app/features/patients/PatientProfileTabs.tsx
import React from "react";
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Paper,
  Button,
  Chip,
  Divider,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  IconButton,
  CircularProgress,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  Alert,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useTranslation } from "react-i18next";
import {
  Edit as EditIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
  EditNote as PrescriptionIcon,
  ExitToApp as DischargeIcon,
} from "@mui/icons-material";
import PermissionGuard from "@app/components/common/PermissionGuard";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@app/lib/apiClient";
import { useAuthStore } from "@app/store/authStore";
import { useToast } from "@app/components/common/ToastProvider";
import { formatDate } from "@app/lib/dateFormat";
import { fetchPrescriptions } from "@app/lib/api/prescriptions";
import { getPrescriptionStatusLabel, getPrescriptionStatusColor } from "@app/lib/utils/statusUtils";
import { Select, MenuItem, FormControl } from "@mui/material";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`patient-tabpanel-${index}`}
      aria-labelledby={`patient-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

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
  photo_path?: string | null;
  department?: string | null;
  created_at: string;
  updated_at: string;
  last_visited_at?: string | null;
}

interface Props {
  patient: Patient;
  onEdit?: () => void;
  onRecordVitals?: () => void;
  documents?: Array<{
    id: string;
    file_name: string;
    document_type?: string | null;
    created_at: string;
  }>;
  documentsLoading?: boolean;
  onUploadDocument?: () => void;
  onDownloadDocument?: (documentId: string, fileName: string) => void;
  onDeleteDocument?: (documentId: string, fileName: string) => void;
  onDischarge?: () => void;
  onWritePrescription?: () => void;
  onOpenAppointment?: (appointmentId: string) => void;
  onOpenAdmission?: (admissionId: string) => void;
  defaultTab?: number;
}

const PatientProfileTabs: React.FC<Props> = ({ 
  patient, 
  onEdit, 
  onRecordVitals, 
  documents = [],
  documentsLoading = false,
  onUploadDocument,
  onDownloadDocument,
  onDeleteDocument,
  onDischarge,
  onWritePrescription,
  onOpenAppointment,
  onOpenAdmission,
  defaultTab = 0,
}) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { showError } = useToast();
  const [value, setValue] = React.useState(defaultTab);
  
  // Update tab when defaultTab prop changes (e.g., when OPD/IPD is created)
  React.useEffect(() => {
    if (defaultTab !== undefined) {
      setValue(defaultTab);
    }
  }, [defaultTab]);

  // Check if user can record vitals (DOCTOR, NURSE, or ADMIN)
  const userRoles = user?.roles?.map((r: any) => r.name) || [];
  const canRecordVitals = userRoles.includes("DOCTOR") || 
                          userRoles.includes("NURSE") || 
                          userRoles.includes("HOSPITAL_ADMIN") || 
                          userRoles.includes("SUPER_ADMIN");

  const handleRecordVitalsClick = () => {
    if (!canRecordVitals) {
      showError(
        t("vitals.permissionDenied", {
          defaultValue: "Only doctors and nurses can record vitals.",
        })
      );
      return;
    }
    if (patient.is_deceased) {
      showError(
        t("vitals.deceasedPatient", {
          defaultValue: "Cannot record vitals for deceased patient.",
        })
      );
      return;
    }
    if (onRecordVitals) {
      onRecordVitals();
    }
  };

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

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

  const age = patient.dob ? calculateAge(patient.dob) : patient.age_only;

  const InfoField: React.FC<{
    label: string;
    value: string | null | undefined | React.ReactNode;
  }> = ({ label, value }) => (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {typeof value === "string" || typeof value === "number" ? (
        <Typography variant="body1" fontWeight={500}>
          {value || "-"}
        </Typography>
      ) : value ? (
        <Box sx={{ mt: 0.5 }}>{value}</Box>
      ) : (
        <Typography variant="body1" fontWeight={500}>
          -
        </Typography>
      )}
    </Grid>
  );

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Tabs value={value} onChange={handleChange}>
          <Tab label={t("patients.overview", { defaultValue: "Overview" })} />
          <Tab label={t("patients.medical", { defaultValue: "Medical" })} />
          <Tab
            label={t("patients.contact", { defaultValue: "Contact & Demographics" })}
          />
          <Tab label={t("patients.documents", { defaultValue: "Documents" })} />
          <Tab label={t("patients.encounters", { defaultValue: "Encounters" })} />
          <Tab label={t("patients.activity", { defaultValue: "Activity" })} />
        </Tabs>
        {onEdit && (
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={onEdit}
            size="small"
          >
            {t("common.edit", { defaultValue: "Edit" })}
          </Button>
        )}
      </Box>

      <TabPanel value={value} index={0}>
        {/* Active IPD Admission Card */}
        <ActiveIPDAdmissionCard
          patientId={patient.id}
          onDischarge={onDischarge}
          onWritePrescription={onWritePrescription}
          t={t}
        />
        
        {/* Today's OPD Appointment Card */}
        {!patient.is_deceased && (
          <NextOPDAppointmentCard
            patientId={patient.id}
            onOpenAppointment={onOpenAppointment}
            t={t}
          />
        )}
        
        <Paper elevation={2} sx={{ p: 3, borderRadius: 3, mt: 3 }}>
          <Typography variant="h6" fontWeight={600} mb={2}>
            {t("patients.overview", { defaultValue: "Overview" })}
          </Typography>
          
          {/* DECEASED Banner */}
          {patient.is_deceased && patient.date_of_death && (
            <Box sx={{ mb: 3 }}>
              <Alert severity="error">
                {t("patients.deceasedOn", {
                  defaultValue: "Deceased on {{date}}",
                  date: new Date(patient.date_of_death).toLocaleDateString(),
                })}
              </Alert>
            </Box>
          )}

          <Grid container spacing={2}>
            <InfoField
              label={t("patients.patientCode", { defaultValue: "Patient Code" })}
              value={patient.patient_code}
            />
            <InfoField
              label={t("patients.age", { defaultValue: "Age" })}
              value={age !== null ? `${age} yrs` : null}
            />
            <InfoField
              label={t("patients.dateOfBirth", { defaultValue: "Date of Birth" })}
              value={
                patient.dob
                  ? new Date(patient.dob).toLocaleDateString()
                  : patient.dob_unknown
                  ? t("patients.unknown", { defaultValue: "Unknown" })
                  : null
              }
            />
            <InfoField
              label={t("patients.gender", { defaultValue: "Gender" })}
              value={patient.gender}
            />
            <InfoField
              label={t("patients.bloodGroup", { defaultValue: "Blood Group" })}
              value={patient.blood_group}
            />
            {patient.known_allergies && (
              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {t("patients.knownAllergies", { defaultValue: "Known Allergies" })}
                </Typography>
                <Chip
                  label={patient.known_allergies}
                  color="error"
                  size="small"
                  sx={{ mr: 1 }}
                />
              </Grid>
            )}
            {patient.is_dnr && (
              <Grid size={{ xs: 12 }}>
                <Chip
                  label={t("patients.dnr", { defaultValue: "DNR" })}
                  color="error"
                  size="small"
                />
              </Grid>
            )}
            {(patient.emergency_contact_name || patient.emergency_contact_phone) && (
              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" fontWeight={600} mb={1}>
                  {t("patients.emergencyContact", { defaultValue: "Emergency Contact" })}
                </Typography>
              </Grid>
            )}
            {patient.emergency_contact_name && (
              <InfoField
                label={t("patients.emergencyContactName", {
                  defaultValue: "Name",
                })}
                value={patient.emergency_contact_name}
              />
            )}
            {patient.emergency_contact_relation && (
              <InfoField
                label={t("patients.emergencyContactRelation", {
                  defaultValue: "Relation",
                })}
                value={patient.emergency_contact_relation}
              />
            )}
            {patient.emergency_contact_phone && (
              <InfoField
                label={t("patients.emergencyContactPhone", {
                  defaultValue: "Phone",
                })}
                value={patient.emergency_contact_phone}
              />
            )}
          </Grid>
        </Paper>
      </TabPanel>

      <TabPanel value={value} index={1}>
        <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" fontWeight={600}>
              {t("patients.medical", { defaultValue: "Medical Information" })}
            </Typography>
            {onRecordVitals && (
              <Button
                variant="outlined"
                size="small"
                onClick={handleRecordVitalsClick}
                disabled={patient.is_deceased}
              >
                {t("vitals.recordVitals", { defaultValue: "Record Vitals" })}
              </Button>
            )}
          </Box>

          {/* DECEASED Banner */}
          {patient.is_deceased && patient.date_of_death && (
            <Box sx={{ mb: 3 }}>
              <Alert severity="error">
                {t("patients.deceasedOn", {
                  defaultValue: "Deceased on {{date}}",
                  date: new Date(patient.date_of_death).toLocaleDateString(),
                })}
              </Alert>
            </Box>
          )}

          {/* Clinical Status Section */}
          {patient.is_deceased && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1}>
                {t("patients.clinicalStatus", { defaultValue: "Clinical Status" })}
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("patients.deceased", { defaultValue: "Deceased" })}
                  </Typography>
                  <Chip
                    label={t("patients.deceased", { defaultValue: "DECEASED" })}
                    color="error"
                    size="small"
                    sx={{ mt: 0.5 }}
                  />
                </Grid>
                {patient.date_of_death && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t("patients.dateOfDeath", { defaultValue: "Date of Death" })}
                    </Typography>
                    <Typography variant="body1">
                      {new Date(patient.date_of_death).toLocaleDateString()}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
          
          {/* Vitals Section */}
          <VitalsSectionWithPagination patientId={patient.id} onRecordVitals={onRecordVitals} />
          
          <Divider sx={{ my: 3 }} />
          
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <Typography variant="body2" color="text.secondary" mb={1}>
                {t("patients.knownAllergies", { defaultValue: "Known Allergies" })}
              </Typography>
              {patient.known_allergies ? (
                <Typography variant="body1">{patient.known_allergies}</Typography>
              ) : (
                <Typography variant="body2" color="text.secondary" fontStyle="italic">
                  {t("patients.noAllergies", {
                    defaultValue: "No allergies recorded",
                  })}
                </Typography>
              )}
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant="body2" color="text.secondary" mb={1}>
                {t("patients.chronicConditions", {
                  defaultValue: "Chronic Conditions",
                })}
              </Typography>
              {patient.chronic_conditions ? (
                <Typography variant="body1">{patient.chronic_conditions}</Typography>
              ) : (
                <Typography variant="body2" color="text.secondary" fontStyle="italic">
                  {t("patients.noConditions", {
                    defaultValue: "No chronic conditions recorded",
                  })}
                </Typography>
              )}
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant="body2" color="text.secondary" mb={1}>
                {t("patients.clinicalNotes", { defaultValue: "Clinical Notes" })}
              </Typography>
              {patient.clinical_notes ? (
                <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
                  {patient.clinical_notes}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary" fontStyle="italic">
                  {t("patients.noNotes", { defaultValue: "No clinical notes" })}
                </Typography>
              )}
            </Grid>
            {patient.is_deceased && (
              <Grid size={{ xs: 12 }}>
                <Chip
                  label={t("patients.deceased", { defaultValue: "Deceased" })}
                  color="error"
                  size="small"
                />
                {patient.date_of_death && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {t("patients.dateOfDeath", { defaultValue: "Date of Death" })}:{" "}
                    {new Date(patient.date_of_death).toLocaleDateString()}
                  </Typography>
                )}
              </Grid>
            )}
          </Grid>
        </Paper>
      </TabPanel>

      <TabPanel value={value} index={2}>
        <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={600} mb={2}>
            {t("patients.contact", { defaultValue: "Contact & Demographics" })}
          </Typography>
          <Grid container spacing={2}>
            <InfoField
              label={t("patients.phonePrimary", { defaultValue: "Primary Phone" })}
              value={patient.phone_primary}
            />
            <InfoField
              label={t("patients.phoneAlternate", { defaultValue: "Alternate Phone" })}
              value={patient.phone_alternate}
            />
            <InfoField
              label={t("patients.email", { defaultValue: "Email" })}
              value={patient.email}
            />
            <InfoField
              label={t("patients.city", { defaultValue: "City" })}
              value={patient.city}
            />
            <InfoField
              label={t("patients.address", { defaultValue: "Address Line 1" })}
              value={patient.address_line1}
            />
            <InfoField
              label={t("patients.addressLine2", { defaultValue: "Address Line 2" })}
              value={patient.address_line2}
            />
            <InfoField
              label={t("patients.postalCode", { defaultValue: "Postal Code" })}
              value={patient.postal_code}
            />
            <InfoField
              label={t("patients.state", { defaultValue: "State" })}
              value={patient.state}
            />
            <InfoField
              label={t("patients.country", { defaultValue: "Country" })}
              value={patient.country}
            />
            <InfoField
              label={t("patients.maritalStatus", { defaultValue: "Marital Status" })}
              value={patient.marital_status}
            />
            <InfoField
              label={t("patients.preferredLanguage", {
                defaultValue: "Preferred Language",
              })}
              value={patient.preferred_language}
            />
            <InfoField
              label={t("patients.nationalIdType", { defaultValue: "National ID Type" })}
              value={patient.national_id_type}
            />
            <InfoField
              label={t("patients.nationalIdNumber", {
                defaultValue: "National ID Number",
              })}
              value={patient.national_id_number}
            />
            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" fontWeight={600} mb={1}>
                {t("patients.consent", { defaultValue: "Consent" })}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                {t("patients.consentSms", { defaultValue: "SMS Consent" })}
              </Typography>
              <Chip
                label={
                  patient.consent_sms
                    ? t("common.yes", { defaultValue: "Yes" })
                    : t("common.no", { defaultValue: "No" })
                }
                size="small"
                color={patient.consent_sms ? "success" : "default"}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                {t("patients.consentEmail", { defaultValue: "Email Consent" })}
              </Typography>
              <Chip
                label={
                  patient.consent_email
                    ? t("common.yes", { defaultValue: "Yes" })
                    : t("common.no", { defaultValue: "No" })
                }
                size="small"
                color={patient.consent_email ? "success" : "default"}
              />
            </Grid>
          </Grid>
        </Paper>
      </TabPanel>

      <TabPanel value={value} index={3}>
        <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" fontWeight={600}>
              {t("patients.documents", { defaultValue: "Documents" })}
            </Typography>
            {onUploadDocument && (
              <PermissionGuard permission="documents:upload">
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<UploadIcon />}
                  onClick={onUploadDocument}
                >
                  {t("documents.upload", { defaultValue: "Upload" })}
                </Button>
              </PermissionGuard>
            )}
          </Box>

          {documentsLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={32} />
            </Box>
          ) : documents && documents.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t("documents.fileName", { defaultValue: "File Name" })}</TableCell>
                    <TableCell>{t("documents.documentType", { defaultValue: "Document Type" })}</TableCell>
                    <TableCell>{t("documents.uploadedAt", { defaultValue: "Uploaded At" })}</TableCell>
                    <TableCell align="right">{t("common.actions", { defaultValue: "Actions" })}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id} hover>
                      <TableCell>{doc.file_name}</TableCell>
                      <TableCell>
                        {doc.document_type || (
                          <Typography variant="body2" color="text.secondary" component="span">
                            {t("documents.noType", { defaultValue: "—" })}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(doc.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="right">
                        {onDownloadDocument && (
                          <IconButton
                            size="small"
                            onClick={() => onDownloadDocument(doc.id, doc.file_name)}
                            title={t("documents.download", { defaultValue: "Download" })}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        )}
                        {onDeleteDocument && (
                          <PermissionGuard permission="documents:delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => onDeleteDocument(doc.id, doc.file_name)}
                              title={t("documents.delete", { defaultValue: "Delete" })}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </PermissionGuard>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box textAlign="center" py={4}>
              <Typography variant="body2" color="text.secondary">
                {t("documents.empty", { defaultValue: "No documents found." })}
              </Typography>
            </Box>
          )}
        </Paper>
      </TabPanel>

      <TabPanel value={value} index={4}>
        <EncountersTab 
          patientId={patient.id} 
          t={t} 
          onOpenAppointment={onOpenAppointment}
          onOpenAdmission={onOpenAdmission}
        />
      </TabPanel>

      <TabPanel value={value} index={5}>
        <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={600} mb={2}>
            {t("patients.activity", { defaultValue: "Activity & Audit" })}
          </Typography>
          <Grid container spacing={2}>
            <InfoField
              label={t("patients.createdAt", { defaultValue: "Created At" })}
              value={new Date(patient.created_at).toLocaleString()}
            />
            <InfoField
              label={t("patients.updatedAt", { defaultValue: "Last Updated" })}
              value={new Date(patient.updated_at).toLocaleString()}
            />
            {patient.last_visited_at && (
              <InfoField
                label={t("patients.lastVisit", { defaultValue: "Last Visit" })}
                value={formatDate(patient.last_visited_at)}
              />
            )}
            {patient.is_deceased && patient.date_of_death && (
              <InfoField
                label={t("patients.markedDeceased", { defaultValue: "Marked Deceased" })}
                value={new Date(patient.date_of_death).toLocaleString()}
              />
            )}
          </Grid>
        </Paper>
      </TabPanel>
    </Box>
  );
};

// Next OPD Appointment Card Component
const NextOPDAppointmentCard: React.FC<{
  patientId: string;
  onOpenAppointment?: (appointmentId: string) => void;
  t: any;
}> = ({ patientId, onOpenAppointment, t }) => {
  const { data: appointments } = useQuery({
    queryKey: ["appointments", patientId, "upcoming"],
    queryFn: async () => {
      try {
        const now = new Date();
        // Format as YYYY-MM-DD for backend date type
        const dateFrom = now.toISOString().split('T')[0];
        const res = await apiClient.get("/appointments", {
          params: {
            patient_id: patientId,
            date_from: dateFrom,
            status: "SCHEDULED",
          },
        });
        const apts = res.data?.items || res.data || [];
        // Sort by scheduled_at ascending and get first
        return apts.sort((a: any, b: any) => 
          new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
        )[0] || null;
      } catch {
        return null;
      }
    },
    enabled: !!patientId,
  });

  if (!appointments) return null;

  return (
    <Card variant="outlined" sx={{ mt: 3, borderLeft: "4px solid", borderLeftColor: "primary.main" }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Typography variant="subtitle1" fontWeight={600}>
            {t("patients.nextOPDAppointment", { defaultValue: "Next OPD Appointment" })}
          </Typography>
          {onOpenAppointment && (
            <Button
              size="small"
              onClick={() => onOpenAppointment(appointments.id)}
            >
              {t("common.view", { defaultValue: "View" })}
            </Button>
          )}
        </Box>
        <Grid container spacing={1}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="body2" color="text.secondary">
              {t("appointments.scheduledAt", { defaultValue: "Date & Time" })}
            </Typography>
            <Typography variant="body1">
              {new Date(appointments.scheduled_at).toLocaleString()}
            </Typography>
          </Grid>
          {appointments.doctor_name && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                {t("appointments.doctor", { defaultValue: "Doctor" })}
              </Typography>
              <Typography variant="body1">{appointments.doctor_name}</Typography>
            </Grid>
          )}
          {appointments.department && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                {t("appointments.department", { defaultValue: "Department" })}
              </Typography>
              <Typography variant="body1">{appointments.department}</Typography>
            </Grid>
          )}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="body2" color="text.secondary">
              {t("appointments.status", { defaultValue: "Status" })}
            </Typography>
            <Chip
              label={appointments.status}
              size="small"
              color={appointments.status === "SCHEDULED" ? "primary" : "default"}
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

// Active IPD Admission Card Component
const ActiveIPDAdmissionCard: React.FC<{
  patientId: string;
  onDischarge?: () => void;
  onWritePrescription?: () => void;
  t: any;
}> = ({ patientId, onDischarge, onWritePrescription, t }) => {
  const { data: activeAdmissions } = useQuery({
    queryKey: ["admissions", "active", patientId],
    queryFn: async () => {
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

  const activeAdmission = activeAdmissions && activeAdmissions.length > 0 ? activeAdmissions[0] : null;

  if (!activeAdmission) return null;

  return (
    <Card variant="outlined" sx={{ mt: 3, borderLeft: "4px solid", borderLeftColor: "primary.main" }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Typography variant="subtitle1" fontWeight={600}>
            {t("patients.activeIPDAdmission", { defaultValue: "Active IPD Admission" })}
          </Typography>
          <Box display="flex" gap={1}>
            {onWritePrescription && (
              <Button
                size="small"
                startIcon={<PrescriptionIcon />}
                onClick={onWritePrescription}
              >
                {t("patients.writeIPDPrescription", { defaultValue: "Write Prescription" })}
              </Button>
            )}
            {onDischarge && (
              <Button
                size="small"
                variant="contained"
                color="primary"
                startIcon={<DischargeIcon />}
                onClick={onDischarge}
              >
                {t("admissions.discharge", { defaultValue: "Discharge" })}
              </Button>
            )}
          </Box>
        </Box>
        <Grid container spacing={1}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="body2" color="text.secondary">
              {t("admissions.admitDatetime", { defaultValue: "Admitted Since" })}
            </Typography>
            <Typography variant="body1">
              {new Date(activeAdmission.admit_datetime).toLocaleString()}
            </Typography>
          </Grid>
          {activeAdmission.department && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                {t("admissions.department", { defaultValue: "Department" })}
              </Typography>
              <Typography variant="body1">{activeAdmission.department}</Typography>
            </Grid>
          )}
          {activeAdmission.doctor_name && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="body2" color="text.secondary">
                {t("admissions.primaryDoctor", { defaultValue: "Primary Doctor" })}
              </Typography>
              <Typography variant="body1">{activeAdmission.doctor_name}</Typography>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
};

// Prescription Display Component for Encounters
const EncounterPrescriptionDisplay: React.FC<{
  appointmentId?: string;
  admissionId?: string;
  t: any;
}> = ({ appointmentId, admissionId, t }) => {
  const [selectedPrescriptionId, setSelectedPrescriptionId] = React.useState<string | null>(null);

  const { data: prescriptions, isLoading } = useQuery({
    queryKey: ["prescriptions", appointmentId || admissionId, appointmentId ? "appointment" : "admission"],
    queryFn: async () => {
      try {
        const filters: any = {};
        if (appointmentId) filters.appointment_id = appointmentId;
        if (admissionId) filters.admission_id = admissionId;
        const data = await fetchPrescriptions(filters);
        // Sort by latest (created_at desc) - backend already sorts, but ensure it here too
        return data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      } catch {
        return [];
      }
    },
    enabled: !!(appointmentId || admissionId),
  });

  React.useEffect(() => {
    if (prescriptions && prescriptions.length > 0 && !selectedPrescriptionId) {
      // Set the latest prescription as default
      setSelectedPrescriptionId(prescriptions[0].id);
    }
  }, [prescriptions, selectedPrescriptionId]);

  if (isLoading) {
    return <CircularProgress size={16} />;
  }

  if (!prescriptions || prescriptions.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t("prescriptions.noPrescription", { defaultValue: "No prescription" })}
      </Typography>
    );
  }

  const selectedPrescription = prescriptions.find(p => p.id === selectedPrescriptionId) || prescriptions[0];

  return (
    <Box>
      {prescriptions.length > 1 ? (
        <FormControl size="small" sx={{ minWidth: 200, mb: 1 }}>
          <Select
            value={selectedPrescriptionId || prescriptions[0].id}
            onChange={(e) => setSelectedPrescriptionId(e.target.value)}
          >
            {prescriptions.map((prescription: any) => (
              <MenuItem key={prescription.id} value={prescription.id}>
                {prescription.prescription_code || prescription.id.substring(0, 8)} - {formatDate(prescription.created_at)} ({getPrescriptionStatusLabel(prescription.status)})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : null}
      <Box>
        <Chip
          label={getPrescriptionStatusLabel(selectedPrescription.status)}
          size="small"
          color={getPrescriptionStatusColor(selectedPrescription.status)}
          sx={{ mr: 1 }}
        />
        <Typography variant="caption" color="text.secondary">
          {formatDate(selectedPrescription.created_at)}
        </Typography>
      </Box>
    </Box>
  );
};

// Encounters Tab Component
const EncountersTab: React.FC<{
  patientId: string;
  t: any;
  onOpenAppointment?: (appointmentId: string) => void;
  onOpenAdmission?: (admissionId: string) => void;
}> = ({ patientId, t, onOpenAppointment, onOpenAdmission }) => {
  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ["appointments", patientId, "all"],
    queryFn: async () => {
      try {
        const res = await apiClient.get("/appointments", {
          params: { patient_id: patientId },
        });
        return res.data?.items || res.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!patientId,
  });

  const { data: admissions, isLoading: admissionsLoading } = useQuery({
    queryKey: ["admissions", patientId, "all"],
    queryFn: async () => {
      try {
        const res = await apiClient.get("/admissions", {
          params: { patient_id: patientId },
        });
        return res.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!patientId,
  });

  return (
    <Box>
      {/* OPD Encounters */}
      <Paper elevation={2} sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight={600} mb={2}>
          {t("patients.opdEncounters", { defaultValue: "OPD Encounters" })}
        </Typography>
        {appointmentsLoading ? (
          <CircularProgress />
        ) : appointments && appointments.length > 0 ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("appointments.scheduledAt", { defaultValue: "Date & Time" })}</TableCell>
                  <TableCell>{t("appointments.department", { defaultValue: "Department" })}</TableCell>
                  <TableCell>{t("appointments.doctor", { defaultValue: "Doctor" })}</TableCell>
                  <TableCell>{t("appointments.status", { defaultValue: "Status" })}</TableCell>
                  <TableCell align="right">{t("common.actions", { defaultValue: "Actions" })}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {appointments.map((apt: any) => (
                  <TableRow key={apt.id} hover>
                    <TableCell>{new Date(apt.scheduled_at).toLocaleString()}</TableCell>
                    <TableCell>{apt.department || "-"}</TableCell>
                    <TableCell>{apt.doctor_name || "-"}</TableCell>
                    <TableCell>
                      <Chip
                        label={apt.status}
                        size="small"
                        color={apt.status === "SCHEDULED" ? "primary" : apt.status === "COMPLETED" ? "success" : "default"}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {onOpenAppointment && (
                        <Button
                          size="small"
                          onClick={() => onOpenAppointment(apt.id)}
                        >
                          {t("common.view", { defaultValue: "View" })}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t("patients.noAppointments", { defaultValue: "No appointments found" })}
          </Typography>
        )}
      </Paper>

      {/* IPD Encounters */}
      <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={600} mb={2}>
          {t("patients.ipdEncounters", { defaultValue: "IPD Encounters" })}
        </Typography>
        {admissionsLoading ? (
          <CircularProgress />
        ) : admissions && admissions.length > 0 ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("admissions.admitDatetime", { defaultValue: "Admit Date" })}</TableCell>
                  <TableCell>{t("admissions.dischargeDatetime", { defaultValue: "Discharge Date" })}</TableCell>
                  <TableCell>{t("admissions.department", { defaultValue: "Department" })}</TableCell>
                  <TableCell>{t("admissions.status", { defaultValue: "Status" })}</TableCell>
                  <TableCell>{t("prescriptions.title", { defaultValue: "Prescription" })}</TableCell>
                  <TableCell align="right">{t("common.actions", { defaultValue: "Actions" })}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {admissions.map((adm: any) => (
                  <TableRow key={adm.id} hover>
                    <TableCell>{new Date(adm.admit_datetime).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {adm.discharge_datetime
                        ? new Date(adm.discharge_datetime).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>{adm.department || "-"}</TableCell>
                    <TableCell>
                      <Chip
                        label={adm.status}
                        size="small"
                        color={adm.status === "ACTIVE" ? "primary" : adm.status === "DISCHARGED" ? "success" : "default"}
                      />
                    </TableCell>
                    <TableCell>
                      <EncounterPrescriptionDisplay admissionId={adm.id} t={t} />
                    </TableCell>
                    <TableCell align="right">
                      {onOpenAdmission && (
                        <Button
                          size="small"
                          onClick={() => onOpenAdmission(adm.id)}
                        >
                          {t("common.view", { defaultValue: "View" })}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t("patients.noAdmissions", { defaultValue: "No admissions found" })}
          </Typography>
        )}
      </Paper>
    </Box>
  );
};

// Helper to convert Celsius to Fahrenheit
const celsiusToFahrenheit = (c: number | null | undefined): number | null => {
  if (c === null || c === undefined) return null;
  return (c * 9) / 5 + 32;
};

// Vitals Section with Pagination Component
const VitalsSectionWithPagination: React.FC<{
  patientId: string;
  onRecordVitals?: () => void;
}> = ({ patientId, onRecordVitals }) => {
  const { t } = useTranslation();
  const [page, setPage] = React.useState(1);
  const [selectedVital, setSelectedVital] = React.useState<any | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  const recordsPerPage = 5;

  const { data: vitals, isLoading } = useQuery({
    queryKey: ["vitals", patientId],
    queryFn: async () => {
      const res = await apiClient.get("/vitals", {
        params: { patient_id: patientId },
      });
      return res.data;
    },
    enabled: !!patientId,
  });

  // Sort by latest (recorded_at descending) and paginate
  const sortedVitals = React.useMemo(() => {
    if (!vitals) return [];
    return [...vitals].sort((a: any, b: any) => 
      new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
    );
  }, [vitals]);

  const totalPages = Math.ceil((sortedVitals?.length || 0) / recordsPerPage);
  const paginatedVitals = sortedVitals?.slice(
    (page - 1) * recordsPerPage,
    page * recordsPerPage
  ) || [];

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={2}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  // Don't show anything if no vitals
  if (!vitals || sortedVitals.length === 0) {
    return null;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight={600}>
          {t("vitals.vitalRecords", { defaultValue: "Vital Records" })}
        </Typography>
      </Box>
      {paginatedVitals.length > 0 ? (
        <>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("vitals.recordedAt", { defaultValue: "Recorded At" })}</TableCell>
                  <TableCell align="right">{t("vitals.systolicBp", { defaultValue: "Systolic BP" })}</TableCell>
                  <TableCell align="right">{t("vitals.diastolicBp", { defaultValue: "Diastolic BP" })}</TableCell>
                  <TableCell align="right">{t("vitals.heartRate", { defaultValue: "Heart Rate" })}</TableCell>
                  <TableCell align="right">{t("vitals.temperature", { defaultValue: "Temperature" })}</TableCell>
                  <TableCell align="right">{t("vitals.respiratoryRate", { defaultValue: "Resp. Rate" })}</TableCell>
                  <TableCell align="right">{t("vitals.spo2", { defaultValue: "SpO2" })}</TableCell>
                  <TableCell align="right">{t("vitals.weight", { defaultValue: "Weight" })}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedVitals.map((vital: any) => (
                  <TableRow 
                    key={vital.id} 
                    hover 
                    sx={{ cursor: "pointer" }}
                    onClick={() => {
                      setSelectedVital(vital);
                      setDetailDialogOpen(true);
                    }}
                  >
                    <TableCell>
                      {new Date(vital.recorded_at).toLocaleString()}
                    </TableCell>
                    <TableCell align="right">
                      {vital.systolic_bp ? `${vital.systolic_bp} mmHg` : "-"}
                    </TableCell>
                    <TableCell align="right">
                      {vital.diastolic_bp ? `${vital.diastolic_bp} mmHg` : "-"}
                    </TableCell>
                    <TableCell align="right">
                      {vital.heart_rate ? `${vital.heart_rate} bpm` : "-"}
                    </TableCell>
                    <TableCell align="right">
                      {vital.temperature_c !== null && vital.temperature_c !== undefined
                        ? `${celsiusToFahrenheit(vital.temperature_c)?.toFixed(1)}°F`
                        : "-"}
                    </TableCell>
                    <TableCell align="right">
                      {vital.respiratory_rate ? `${vital.respiratory_rate}/min` : "-"}
                    </TableCell>
                    <TableCell align="right">
                      {vital.spo2 ? `${vital.spo2}%` : "-"}
                    </TableCell>
                    <TableCell align="right">
                      {vital.weight_kg !== null && vital.weight_kg !== undefined ? `${vital.weight_kg} kg` : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={2}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, newPage) => setPage(newPage)}
                size="small"
                color="primary"
              />
            </Box>
          )}
        </>
      ) : (
        <Box textAlign="center" py={2}>
          <Typography variant="body2" color="text.secondary">
            {t("vitals.empty", { defaultValue: "No vitals recorded yet" })}
          </Typography>
        </Box>
      )}

      {/* Vital Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {t("vitals.vitalDetails", { defaultValue: "Vital Record Details" })}
        </DialogTitle>
        <DialogContent>
          {selectedVital && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  {t("vitals.recordedAt", { defaultValue: "Recorded At" })}
                </Typography>
                <Typography variant="body1" fontWeight={500}>
                  {new Date(selectedVital.recorded_at).toLocaleString()}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  {t("vitals.systolicBp", { defaultValue: "Systolic BP" })}
                </Typography>
                <Typography variant="body1" fontWeight={500}>
                  {selectedVital.systolic_bp ? `${selectedVital.systolic_bp} mmHg` : "-"}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  {t("vitals.diastolicBp", { defaultValue: "Diastolic BP" })}
                </Typography>
                <Typography variant="body1" fontWeight={500}>
                  {selectedVital.diastolic_bp ? `${selectedVital.diastolic_bp} mmHg` : "-"}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  {t("vitals.heartRate", { defaultValue: "Heart Rate" })}
                </Typography>
                <Typography variant="body1" fontWeight={500}>
                  {selectedVital.heart_rate ? `${selectedVital.heart_rate} bpm` : "-"}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  {t("vitals.temperature", { defaultValue: "Temperature" })}
                </Typography>
                <Typography variant="body1" fontWeight={500}>
                  {selectedVital.temperature_c !== null && selectedVital.temperature_c !== undefined
                    ? `${celsiusToFahrenheit(selectedVital.temperature_c)?.toFixed(1)}°F`
                    : "-"}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  {t("vitals.respiratoryRate", { defaultValue: "Respiratory Rate" })}
                </Typography>
                <Typography variant="body1" fontWeight={500}>
                  {selectedVital.respiratory_rate ? `${selectedVital.respiratory_rate}/min` : "-"}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  {t("vitals.spo2", { defaultValue: "SpO2" })}
                </Typography>
                <Typography variant="body1" fontWeight={500}>
                  {selectedVital.spo2 ? `${selectedVital.spo2}%` : "-"}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  {t("vitals.weight", { defaultValue: "Weight" })}
                </Typography>
                <Typography variant="body1" fontWeight={500}>
                  {selectedVital.weight_kg !== null && selectedVital.weight_kg !== undefined ? `${selectedVital.weight_kg} kg` : "-"}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  {t("vitals.height", { defaultValue: "Height" })}
                </Typography>
                <Typography variant="body1" fontWeight={500}>
                  {selectedVital.height_cm !== null && selectedVital.height_cm !== undefined ? `${selectedVital.height_cm} cm` : "-"}
                </Typography>
              </Grid>
              {selectedVital.notes && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    {t("vitals.notes", { defaultValue: "Notes" })}
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="body1" whiteSpace="pre-wrap">
                      {selectedVital.notes}
                    </Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>
            {t("common.close", { defaultValue: "Close" })}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PatientProfileTabs;

