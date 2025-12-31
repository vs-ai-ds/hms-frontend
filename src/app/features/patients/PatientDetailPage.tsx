// src/app/features/patients/PatientDetailPage.tsx
import React from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  Divider,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  ArrowBack as ArrowBackIcon,
  Upload as UploadIcon,
  Delete as DeleteIcon,
  PhotoCamera as PhotoCameraIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@app/lib/apiClient";
import { useTranslation } from "react-i18next";
import { AppRoutes } from "@app/routes";
import { useToast } from "@app/components/common/ToastProvider";
import PatientProfileTabs from "./PatientProfileTabs";
import PatientProfileEditDialog from "./PatientProfileEditDialog";
import PatientShareDialog from "./PatientShareDialog";
import VitalsDialog from "./VitalsDialog";
import AppointmentFormDialog from "@app/features/appointments/AppointmentFormDialog";
import AdmissionFormDialog from "@app/features/admissions/AdmissionFormDialog";
import DischargeDialog from "@app/features/admissions/DischargeDialog";
import PrescriptionFormDialog from "@app/features/prescriptions/PrescriptionFormDialog";
import VisitTypeSelectionDialog from "@app/components/common/VisitTypeSelectionDialog";
import AppointmentDetailDialog from "@app/components/appointments/AppointmentDetailDialog";
import { useAuthStore } from "@app/store/authStore";

import { can } from "@app/lib/abac";
import ConfirmationDialog from "@app/components/common/ConfirmationDialog";
import { formatDate } from "@app/lib/dateFormat";
import {
  Avatar,
  Card,
  CardContent,
} from "@mui/material";
import {
  Phone as PhoneIcon,
  Email as EmailIcon,
  CalendarToday as CalendarIcon,
  LocalHospital as HospitalIcon,
  Share as ShareIcon,
  EditNote as PrescriptionIcon,
} from "@mui/icons-material";

interface Patient {
  id: string;
  patient_code?: string | null;
  first_name: string;
  middle_name?: string | null;
  last_name?: string | null;
  phone_primary?: string | null;
  phone?: string | null;
  email?: string | null;
  department?: string | null;
  department_id?: string | null;
  patient_type: "OPD" | "IPD";
  dob?: string | null;
  dob_unknown?: boolean;
  age_only?: number | null;
  gender?: string | null;
  city?: string | null;
  blood_group?: string | null;
  known_allergies?: string | null;
  is_dnr?: boolean;
  is_deceased?: boolean;
  date_of_death?: string | null;
  photo_path?: string | null;
  created_at: string;
  updated_at: string;
  last_visited_at?: string | null;
}

interface Document {
  id: string;
  file_name: string;
  mime_type?: string | null;
  document_type?: string | null;
  uploaded_by_id?: string | null;
  created_at: string;
}

const fetchPatient = async (id: string): Promise<Patient> => {
  const res = await apiClient.get<Patient>(`/patients/${id}`);
  return res.data;
};

const fetchDocuments = async (patientId: string): Promise<Document[]> => {
  const res = await apiClient.get<Document[]>(`/documents?patient_id=${patientId}`);
  return res.data;
};

const PatientDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false);
  const [vitalsDialogOpen, setVitalsDialogOpen] = React.useState(false);
  const [appointmentDialogOpen, setAppointmentDialogOpen] = React.useState(false);
  const [admissionDialogOpen, setAdmissionDialogOpen] = React.useState(false);
  const [dischargeDialogOpen, setDischargeDialogOpen] = React.useState(false);
  const [prescriptionDialogOpen, setPrescriptionDialogOpen] = React.useState(false);
  const [visitTypeDialogOpen, setVisitTypeDialogOpen] = React.useState(false);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [documentTypes, setDocumentTypes] = React.useState<string[]>([]);
  const [customDocumentTypes, setCustomDocumentTypes] = React.useState<string[]>([]);
  const [appointmentDetailDialogOpen, setAppointmentDetailDialogOpen] = React.useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = React.useState<string | null>(null);
  const [admissionDetailDialogOpen, setAdmissionDetailDialogOpen] = React.useState(false);
  const [selectedAdmissionId, setSelectedAdmissionId] = React.useState<string | null>(null);
  const [defaultTabIndex, setDefaultTabIndex] = React.useState<number | undefined>(undefined);
  const { showSuccess, showError } = useToast();
  
  // Note: Appointment detail is now handled by AppointmentDetailDialog component
  
  // Fetch admission detail when dialog opens
  const { data: admissionDetail, isLoading: admissionDetailLoading } = useQuery({
    queryKey: ["admission", selectedAdmissionId],
    queryFn: async () => {
      if (!selectedAdmissionId) return null;
      const res = await apiClient.get(`/admissions/${selectedAdmissionId}`);
      return res.data;
    },
    enabled: !!selectedAdmissionId && admissionDetailDialogOpen,
  });
  
  const { user } = useAuthStore();
  const canShare = can(user, "sharing:create");
  
  // State for profile picture blob URL
  const [profilePictureUrl, setProfilePictureUrl] = React.useState<string | null>(null);

  const { data: patient, isLoading: patientLoading, refetch: refetchPatient } = useQuery({
    queryKey: ["patient", id],
    queryFn: () => fetchPatient(id!),
    enabled: !!id,
  });

  // Fetch profile picture as blob when patient has photo_path
  React.useEffect(() => {
    if (!patient?.id || !patient?.photo_path) {
      setProfilePictureUrl((prevUrl) => {
        if (prevUrl) {
          URL.revokeObjectURL(prevUrl);
        }
        return null;
      });
      return;
    }

    let isCancelled = false;
    
    const fetchProfilePicture = async () => {
      try {
        const response = await apiClient.get(`/patients/${patient.id}/profile-picture`, {
          responseType: "blob",
        });
        if (isCancelled) {
          URL.revokeObjectURL(URL.createObjectURL(response.data));
          return;
        }
        const objectUrl = URL.createObjectURL(response.data);
        setProfilePictureUrl((prevUrl) => {
          if (prevUrl) {
            URL.revokeObjectURL(prevUrl);
          }
          return objectUrl;
        });
      } catch (error) {
        // If image fetch fails, just don't set the URL (fallback to initials)
        if (!isCancelled) {
          setProfilePictureUrl((prevUrl) => {
            if (prevUrl) {
              URL.revokeObjectURL(prevUrl);
            }
            return null;
          });
        }
      }
    };

    fetchProfilePicture();

    // Cleanup: revoke object URL when component unmounts or patient changes
    return () => {
      isCancelled = true;
      setProfilePictureUrl((prevUrl) => {
        if (prevUrl) {
          URL.revokeObjectURL(prevUrl);
        }
        return null;
      });
    };
  }, [patient?.id, patient?.photo_path]);

  const { data: documents, isLoading: documentsLoading, refetch: refetchDocuments } = useQuery({
    queryKey: ["documents", id],
    queryFn: () => fetchDocuments(id!),
    enabled: !!id,
  });

  // Check for active admission
  const { data: activeAdmissions, refetch: refetchActiveAdmissions } = useQuery({
    queryKey: ["admissions", "active", id],
    queryFn: async () => {
      if (!id) return [];
      try {
        const res = await apiClient.get("/admissions", {
          params: { patient_id: id, status: "ACTIVE" },
        });
        return res.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!id,
  });

  const hasActiveAdmission = activeAdmissions && activeAdmissions.length > 0;
  const activeAdmission = hasActiveAdmission ? activeAdmissions[0] : null;

  const uploadMutation = useMutation({
    mutationFn: async ({ files, types }: { files: File[]; types: string[] }) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });
      // Add document types as query parameters
      const params = new URLSearchParams();
      params.append("patient_id", id!);
      types.forEach((type) => {
        if (type) {
          params.append("document_types", type);
        }
      });
      await apiClient.post(`/documents?${params.toString()}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
    },
    onSuccess: () => {
      refetchDocuments();
      setUploadDialogOpen(false);
      setSelectedFiles([]);
      setDocumentTypes([]);
      setCustomDocumentTypes([]);
      showSuccess(
        t("documents.uploadSuccess", {
          defaultValue: "Document(s) uploaded successfully",
        })
      );
    },
    onError: (error: any) => {
      showError(
        error?.response?.data?.detail ||
          t("documents.uploadError", {
            defaultValue: "Failed to upload document(s)",
          })
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      await apiClient.delete(`/documents/${documentId}`);
    },
    onSuccess: () => {
      refetchDocuments();
      showSuccess(
        t("documents.deleteSuccess", {
          defaultValue: "Document deleted successfully",
        })
      );
    },
    onError: (error: any) => {
      showError(
        error?.response?.data?.detail ||
          t("documents.deleteError", {
            defaultValue: "Failed to delete document",
          })
      );
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    const allowedExtensions = [
      // Documents
      ".pdf",
      ".doc",
      ".docx",
      ".txt",
      ".rtf",
      ".odt",
      // Spreadsheets
      ".xls",
      ".xlsx",
      ".csv",
      ".ods",
      // Presentations
      ".ppt",
      ".pptx",
      ".odp",
      // Images
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".bmp",
      ".tiff",
      ".tif",
      ".webp",
      ".svg",
      // Medical Imaging
      ".dcm",
      ".dicom",
      // Archives
      ".zip",
      ".rar",
      // Web formats
      ".html",
      ".htm",
      // Audio
      ".mp3",
      ".wav",
      ".m4a",
      ".ogg",
      // Video
      ".mp4",
      ".avi",
      ".mov",
      ".wmv",
      ".mkv",
      // Structured data
      ".xml",
      ".json",
    ];

    const validFiles = files.filter((file) => {
      const lower = file.name.toLowerCase();
      const isValid = allowedExtensions.some((ext) => lower.endsWith(ext));
      if (!isValid) {
        showError(
          t("documents.invalidType", {
            defaultValue: `File type not allowed: ${file.name}`,
          })
        );
      }
      return isValid;
    });

    // Validate file sizes
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB
    const MAX_FILES = 10;

    const sizeValidFiles = validFiles.filter((file) => {
      if (file.size > MAX_FILE_SIZE) {
        showError(
          t("documents.fileTooLarge", {
            defaultValue: `File "${file.name}" exceeds 10MB limit`,
          })
        );
        return false;
      }
      return true;
    });

    // Prepend new files to the beginning (new files appear at top)
    const combined = [...sizeValidFiles, ...selectedFiles];
    
    // Check total size
    const totalSize = combined.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
      showError(
        t("documents.totalSizeExceeded", {
          defaultValue: `Total file size exceeds 50MB limit`,
        })
      );
      return;
    }

    if (combined.length > MAX_FILES) {
      showError(
        t("documents.maxFiles", {
          defaultValue: `You can upload a maximum of ${MAX_FILES} files at a time`,
        })
      );
      // Keep the first MAX_FILES files (newest ones)
      const trimmedFiles = combined.slice(0, MAX_FILES);
      setSelectedFiles(trimmedFiles);
      // Preserve document types for files that are kept
      // New files are at the beginning, so we need to adjust indices
      const newTypes = Array(MAX_FILES).fill("");
      const newCustomTypes = Array(MAX_FILES).fill("");
      // Copy existing document types for files that were already selected
      trimmedFiles.forEach((file, newIndex) => {
        const oldIndex = selectedFiles.findIndex(f => f === file);
        if (oldIndex !== -1) {
          newTypes[newIndex] = documentTypes[oldIndex] || "";
          newCustomTypes[newIndex] = customDocumentTypes[oldIndex] || "";
        }
      });
      setDocumentTypes(newTypes);
      setCustomDocumentTypes(newCustomTypes);
    } else {
      setSelectedFiles(combined);
      // Preserve existing document types and add empty strings for new files
      // New files are prepended, so we need to add empty strings at the beginning
      const newTypes = [...Array(sizeValidFiles.length).fill(""), ...documentTypes];
      const newCustomTypes = [...Array(sizeValidFiles.length).fill(""), ...customDocumentTypes];
      setDocumentTypes(newTypes);
      setCustomDocumentTypes(newCustomTypes);
    }
    
    // Reset the file input so the same file can be selected again if needed
    event.target.value = "";
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) return;
    
    // Prepare document types (use custom type if "Other" is selected)
    const types = documentTypes.map((type, idx) => {
      if (type === "Other" && customDocumentTypes[idx]) {
        return customDocumentTypes[idx];
      }
      return type || "";
    });
    
    uploadMutation.mutate({ files: selectedFiles, types });
  };

  const handleRemoveSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const [deleteDocDialogOpen, setDeleteDocDialogOpen] = React.useState(false);
  const [documentToDelete, setDocumentToDelete] = React.useState<{ id: string; name: string } | null>(null);
  const [profilePictureInputRef, setProfilePictureInputRef] = React.useState<HTMLInputElement | null>(null);

  const handleDeleteDocumentAction = (documentId: string, fileName: string) => {
    setDocumentToDelete({ id: documentId, name: fileName });
    setDeleteDocDialogOpen(true);
  };

  const confirmDeleteDocument = () => {
    if (documentToDelete) {
      deleteMutation.mutate(documentToDelete.id);
      setDeleteDocDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const handleDownloadDocument = async (documentId: string, fileName: string) => {
    try {
      const response = await apiClient.get(`/documents/${documentId}/download`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download document:", error);
    }
  };

  const handleProfilePictureUpload = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !patient?.id) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      showError(
        t("patients.invalidImageType", {
          defaultValue: "Invalid image type. Please upload JPG, PNG, WEBP, or GIF files.",
        })
      );
      return;
    }

    // Validate file size (5MB max)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      showError(
        t("patients.imageTooLarge", {
          defaultValue: "Image size exceeds 5MB limit. Please choose a smaller image.",
        })
      );
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      await apiClient.post(`/patients/${patient.id}/profile-picture`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      showSuccess(
        t("patients.profilePictureUpdated", {
          defaultValue: "Profile picture updated successfully",
        })
      );
      // Refetch patient data - the useEffect will automatically refetch the profile picture
      await refetchPatient();
    } catch (error: any) {
      showError(
        error?.response?.data?.detail ||
          t("patients.profilePictureUpdateError", {
            defaultValue: "Failed to update profile picture",
          })
      );
    } finally {
      // Reset input
      if (event.target) {
        event.target.value = "";
      }
    }
  }, [patient?.id, showError, showSuccess, t, refetchPatient]);

  if (patientLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!patient) {
    return (
      <Box>
        <Typography variant="h6" color="error">
          {t("patients.notFound", { defaultValue: "Patient not found" })}
        </Typography>
        <Button onClick={() => navigate(AppRoutes.PATIENTS)} sx={{ mt: 2 }}>
          {t("common.back", { defaultValue: "Back to Patients" })}
        </Button>
      </Box>
    );
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

  const age = patient.dob ? calculateAge(patient.dob) : patient.age_only;
  const displayName = [
    patient.first_name,
    patient.middle_name,
    patient.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Box>
      {/* Patient Header */}
      <Card elevation={2} sx={{ mb: 3, borderRadius: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={3}>
            <IconButton onClick={() => navigate(AppRoutes.PATIENTS)} size="large">
              <ArrowBackIcon />
            </IconButton>
            <Box sx={{ position: "relative" }}>
              <Avatar
                sx={{
                  width: 64,
                  height: 64,
                  bgcolor: "primary.main",
                  fontSize: "1.5rem",
                }}
                src={profilePictureUrl || undefined}
              >
                {patient.first_name[0]}
                {patient.last_name?.[0] || ""}
              </Avatar>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                style={{ display: "none" }}
                ref={(el) => setProfilePictureInputRef(el)}
                onChange={handleProfilePictureUpload}
              />
              {can(user, "patients:update") && (
                <IconButton
                  size="small"
                  sx={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    bgcolor: "primary.main",
                    color: "white",
                    "&:hover": { bgcolor: "primary.dark" },
                    width: 28,
                    height: 28,
                  }}
                  onClick={() => profilePictureInputRef?.click()}
                >
                  <PhotoCameraIcon sx={{ fontSize: 16 }} />
                </IconButton>
              )}
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <Box display="flex" alignItems="center" gap={2} mb={1}>
                <Typography variant="h5" fontWeight={600}>
                  {displayName}
                  {patient.is_deceased && (
                    <Chip
                      label={t("patients.deceased", { defaultValue: "Deceased" })}
                      color="error"
                      size="small"
                      sx={{ ml: 1, fontWeight: 600 }}
                    />
                  )}
                </Typography>
                {patient.patient_code && (
                  <Chip
                    label={patient.patient_code}
                    size="small"
                    variant="outlined"
                  />
                )}
                {patient.known_allergies && (
                  <Chip
                    label={t("patients.allergy", { defaultValue: "Allergy" })}
                    color="error"
                    size="small"
                  />
                )}
                {patient.is_dnr && (
                  <Chip
                    label={t("patients.dnr", { defaultValue: "DNR" })}
                    color="error"
                    size="small"
                  />
                )}
              </Box>
              <Typography variant="body2" color="text.secondary" mb={1}>
                {patient.patient_code && `${patient.patient_code} • `}
                {age !== null && `${age} yrs`}
                {patient.dob &&
                  ` (DOB: ${formatDate(patient.dob)})`}
                {patient.city && ` • ${patient.city}`}
              </Typography>
              <Box display="flex" gap={2} alignItems="center">
                {patient.phone_primary && (
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <PhoneIcon fontSize="small" color="action" />
                    <Typography
                      variant="body2"
                      component="a"
                      href={`tel:${patient.phone_primary}`}
                      sx={{ textDecoration: "none", color: "primary.main" }}
                    >
                      {patient.phone_primary}
                    </Typography>
                  </Box>
                )}
                {patient.email && (
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <EmailIcon fontSize="small" color="action" />
                    <Typography
                      variant="body2"
                      component="a"
                      href={`mailto:${patient.email}`}
                      sx={{ textDecoration: "none", color: "primary.main" }}
                    >
                      {patient.email}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
            <Box display="flex" gap={1}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CalendarIcon />}
                onClick={() => {
                  if (patient.is_deceased) {
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
                  // Open OPD appointment form directly
                  setAppointmentDialogOpen(true);
                }}
                disabled={patient.is_deceased || hasActiveAdmission}
              >
                {t("patients.newOPDAppointment", {
                  defaultValue: "New OPD Appointment",
                })}
              </Button>
              {!hasActiveAdmission && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<HospitalIcon />}
                  onClick={() => {
                    if (patient.is_deceased) {
                      showError(
                        t("patients.deceasedCannotAdmit", {
                          defaultValue: "Cannot admit deceased patient",
                        })
                      );
                      return;
                    }
                    // Open admission dialog with same logic as quick registration step 2
                    setAdmissionDialogOpen(true);
                  }}
                  disabled={patient.is_deceased}
                >
                  {t("patients.admit", { defaultValue: "Admit" })}
                </Button>
              )}
              {hasActiveAdmission && activeAdmission && (
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<HospitalIcon />}
                  onClick={() => setDischargeDialogOpen(true)}
                >
                  {t("admissions.discharge", { defaultValue: "Discharge" })}
                </Button>
              )}
              {canShare && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ShareIcon />}
                  onClick={() => setShareDialogOpen(true)}
                >
                  {t("patients.shareRecord", { defaultValue: "Share Record" })}
                </Button>
              )}
              {can(user, "prescriptions:create") && (
                <Button
                  variant="contained"
                  color="success"
                  size="small"
                  startIcon={<PrescriptionIcon />}
                  onClick={() => {
                    if (patient?.is_deceased) {
                      showError(
                        t("patients.deceasedCannotPrescribe", {
                          defaultValue: "Cannot write prescription for deceased patient",
                        })
                      );
                      return;
                    }
                    setPrescriptionDialogOpen(true);
                  }}
                  disabled={patient?.is_deceased}
                >
                  {t("patients.writePrescription", { defaultValue: "Write Prescription" })}
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
      <Grid container spacing={3}>

        <Grid size={{ xs: 12 }}>
          <PatientProfileTabs
            patient={patient}
            onEdit={() => setEditDialogOpen(true)}
            onDischarge={() => setDischargeDialogOpen(true)}
            onWritePrescription={() => {
              setPrescriptionDialogOpen(true);
            }}
            onOpenAppointment={(appointmentId) => {
              setSelectedAppointmentId(appointmentId);
              setAppointmentDetailDialogOpen(true);
            }}
            onOpenAdmission={(admissionId) => {
              setSelectedAdmissionId(admissionId);
              setAdmissionDetailDialogOpen(true);
            }}
            defaultTab={defaultTabIndex}
            onRecordVitals={() => {
              if (patient?.is_deceased) {
                showError(
                  t("vitals.deceasedPatient", {
                    defaultValue: "Cannot record vitals for deceased patient.",
                  })
                );
                return;
              }
              setVitalsDialogOpen(true);
            }}
            documents={documents}
            documentsLoading={documentsLoading}
            onUploadDocument={() => setUploadDialogOpen(true)}
            onDownloadDocument={handleDownloadDocument}
            onDeleteDocument={(docId, fileName) => {
              setDocumentToDelete({ id: docId, name: fileName });
              setDeleteDocDialogOpen(true);
            }}
          />
        </Grid>
      </Grid>
      <Dialog
        open={uploadDialogOpen}
        onClose={() => {
          setUploadDialogOpen(false);
          setSelectedFiles([]);
          setDocumentTypes([]);
          setCustomDocumentTypes([]);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t("documents.upload", { defaultValue: "Upload Document" })}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.rtf,.odt,.xls,.xlsx,.csv,.ods,.ppt,.pptx,.odp,.png,.jpg,.jpeg,.gif,.bmp,.tiff,.tif,.webp,.svg,.dcm,.dicom,.zip,.rar,.html,.htm,.mp3,.wav,.m4a,.ogg,.mp4,.avi,.mov,.wmv,.mkv,.xml,.json"
              multiple
              onChange={handleFileSelect}
              style={{ display: "none" }}
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button
                variant="outlined"
                component="span"
                fullWidth
                startIcon={<UploadIcon />}
                sx={{ mb: 2 }}
              >
                {t("documents.selectFile", { defaultValue: "Select File" })}
              </Button>
            </label>
            {selectedFiles.length > 0 && (
              <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                {selectedFiles.map((file, index) => {
                  const documentTypeOptions = [
                    "Prescription",
                    "Lab Report",
                    "X-Ray",
                    "CT Scan",
                    "MRI",
                    "Ultrasound",
                    "Blood Test",
                    "ECG",
                    "Discharge Summary",
                    "Medical Certificate",
                    "Insurance Document",
                    "ID Proof",
                    "Other",
                  ];
                  
                  return (
                    <Box
                      key={`${file.name}-${index}`}
                      sx={{
                        border: "1px solid rgba(0,0,0,0.12)",
                        borderRadius: 1,
                        p: 1.5,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                        <Typography variant="body2" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, mr: 1 }}>
                          {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                        </Typography>
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => handleRemoveSelectedFile(index)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label={t("documents.documentType", { defaultValue: "Document Type" })}
                        value={documentTypes[index] || ""}
                        onChange={(e) => {
                          const newTypes = [...documentTypes];
                          newTypes[index] = e.target.value;
                          setDocumentTypes(newTypes);
                        }}
                      >
                        <MenuItem value="">{t("common.select", { defaultValue: "Select..." })}</MenuItem>
                        {documentTypeOptions.map((option) => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </TextField>
                      {documentTypes[index] === "Other" && (
                        <TextField
                          fullWidth
                          size="small"
                          label={t("documents.customType", { defaultValue: "Enter Document Type" })}
                          value={customDocumentTypes[index] || ""}
                          onChange={(e) => {
                            const newCustomTypes = [...customDocumentTypes];
                            newCustomTypes[index] = e.target.value;
                            setCustomDocumentTypes(newCustomTypes);
                          }}
                          sx={{ mt: 1 }}
                        />
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setUploadDialogOpen(false);
              setSelectedFiles([]);
              setDocumentTypes([]);
              setCustomDocumentTypes([]);
            }}
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || uploadMutation.isPending}
          >
            {uploadMutation.isPending
              ? t("documents.uploading", { defaultValue: "Uploading..." })
              : t("documents.upload", { defaultValue: "Upload" })}
          </Button>
        </DialogActions>
      </Dialog>
      {patient && (
        <>
          <PatientProfileEditDialog
            open={editDialogOpen}
            patient={patient}
            onClose={() => {
              setEditDialogOpen(false);
            }}
            onUpdated={async () => {
              await refetchPatient();
              await refetchDocuments();
            }}
          />
          <PatientShareDialog
            open={shareDialogOpen}
            onClose={() => setShareDialogOpen(false)}
            patientId={patient.id}
          />

          <ConfirmationDialog
            open={deleteDocDialogOpen}
            onClose={() => {
              setDeleteDocDialogOpen(false);
              setDocumentToDelete(null);
            }}
            onConfirm={confirmDeleteDocument}
            title={t("documents.confirmDeleteTitle", { defaultValue: "Delete Document" })}
            message={t("documents.deleteConfirm", {
              defaultValue: `Are you sure you want to delete "${documentToDelete?.name}"? This action cannot be undone.`,
              name: documentToDelete?.name || "",
            })}
            confirmText={t("common.delete", { defaultValue: "Delete" })}
            confirmColor="error"
            isLoading={deleteMutation.isPending}
          />

          {patient && (
            <>
              <VitalsDialog
                open={vitalsDialogOpen}
                patientId={patient.id}
                onClose={() => setVitalsDialogOpen(false)}
                onRecorded={() => {
                  queryClient.invalidateQueries({ queryKey: ["vitals", patient.id] });
                  refetchPatient();
                  setVitalsDialogOpen(false);
                }}
              />
              <AppointmentFormDialog
                open={appointmentDialogOpen}
                onClose={() => setAppointmentDialogOpen(false)}
                onCreated={async () => {
                  refetchPatient();
                  setAppointmentDialogOpen(false);
                  // Invalidate appointment queries to refresh encounter tab
                  await queryClient.invalidateQueries({ queryKey: ["appointments", patient.id] });
                  await queryClient.invalidateQueries({ queryKey: ["appointments", patient.id, "all"] });
                  await queryClient.invalidateQueries({ queryKey: ["appointments", patient.id, "upcoming"] });
                  // Switch to Encounters tab (index 4) to show the new appointment
                  setDefaultTabIndex(4);
                  showSuccess(
                    t("appointments.createSuccessWithPatient", {
                      defaultValue: "OPD appointment created for {{name}}",
                      name: patient ? `${patient.first_name} ${patient.last_name || ""}`.trim() : "patient",
                    })
                  );
                }}
                initialPatientId={patient.id}
              />
              <AdmissionFormDialog
                open={admissionDialogOpen}
                onClose={() => setAdmissionDialogOpen(false)}
                onCreated={async () => {
                  refetchPatient();
                  setAdmissionDialogOpen(false);
                  // Invalidate admission queries to refresh encounter tab
                  await queryClient.invalidateQueries({ queryKey: ["admissions", patient.id] });
                  await queryClient.invalidateQueries({ queryKey: ["admissions", "active", patient.id] });
                  // Switch to Encounters tab (index 4) to show the new admission
                  setDefaultTabIndex(4);
                  showSuccess(
                    t("admissions.createSuccessWithPatient", {
                      defaultValue: "Patient {{name}} admitted successfully",
                      name: patient ? `${patient.first_name} ${patient.last_name || ""}`.trim() : "patient",
                    })
                  );
                }}
                initialPatientId={patient.id}
              />
              {activeAdmission && (
                <DischargeDialog
                  open={dischargeDialogOpen}
                  onClose={() => setDischargeDialogOpen(false)}
                  onDischarged={async () => {
                    setDischargeDialogOpen(false);
                    // Invalidate and refetch all related queries to refresh UI state immediately
                    await queryClient.invalidateQueries({ queryKey: ["admissions"] }); // All admissions queries
                    await queryClient.invalidateQueries({ queryKey: ["admissions", "active"] }); // All active admission queries
                    await queryClient.invalidateQueries({ queryKey: ["patient", patient.id] });
                    await queryClient.invalidateQueries({ queryKey: ["patients"] }); // All patient list queries
                    await queryClient.invalidateQueries({ queryKey: ["appointments"] }); // All appointment queries
                    // Refetch queries immediately to update UI
                    await queryClient.refetchQueries({ queryKey: ["admissions", "active", patient.id] });
                    await queryClient.refetchQueries({ queryKey: ["patient", patient.id] });
                    await queryClient.refetchQueries({ queryKey: ["patients"] });
                    await queryClient.refetchQueries({ queryKey: ["appointments", patient.id] });
                    // Explicitly refetch active admissions to update hasActiveAdmission immediately
                    await refetchActiveAdmissions();
                    // Refetch patient data to update hasActiveAdmission
                    await refetchPatient();
                    showSuccess(
                      t("admissions.dischargeSuccessWithPatient", {
                        defaultValue: "Patient {{name}} discharged successfully",
                        name: patient ? `${patient.first_name} ${patient.last_name || ""}`.trim() : "patient",
                      })
                    );
                  }}
                  admissionId={activeAdmission.id}
                  admitDatetime={activeAdmission.admit_datetime}
                />
              )}
              <VisitTypeSelectionDialog
                open={visitTypeDialogOpen}
                onClose={() => setVisitTypeDialogOpen(false)}
                onSelectOPD={() => {
                  setVisitTypeDialogOpen(false);
                  setAppointmentDialogOpen(true);
                }}
                onSelectIPD={() => {
                  setVisitTypeDialogOpen(false);
                  setAdmissionDialogOpen(true);
                }}
              />
              <PrescriptionFormDialog
                open={prescriptionDialogOpen}
                onClose={() => setPrescriptionDialogOpen(false)}
                onCreated={() => {
                  refetchPatient();
                  setPrescriptionDialogOpen(false);
                  showSuccess(
                    t("notifications.prescriptionCreatedWithPatient", {
                      defaultValue: "Prescription created for {{name}}",
                      name: patient ? `${patient.first_name} ${patient.last_name || ""}`.trim() : "patient",
                    })
                  );
                }}
                initialPatientId={patient?.id}
              />
              
              {/* Appointment Detail Dialog */}
              <AppointmentDetailDialog
                open={appointmentDetailDialogOpen}
                appointmentId={selectedAppointmentId}
                onClose={() => {
                  setAppointmentDetailDialogOpen(false);
                  setSelectedAppointmentId(null);
                }}
                onViewPrescription={(prescriptionId) => {
                  // Navigate to prescription detail page or open prescription detail dialog
                  // For now, we'll just navigate to the prescription page
                  navigate(`/prescriptions?id=${prescriptionId}`);
                }}
              />
              
              {/* Admission Detail Dialog */}
              <Dialog 
                open={admissionDetailDialogOpen} 
                onClose={() => {
                  setAdmissionDetailDialogOpen(false);
                  setSelectedAdmissionId(null);
                }} 
                maxWidth="md" 
                fullWidth
              >
                <DialogTitle>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography variant="h6">
                      {t("admissions.details", { defaultValue: "Admission Details" })}
                    </Typography>
                    <IconButton onClick={() => {
                      setAdmissionDetailDialogOpen(false);
                      setSelectedAdmissionId(null);
                    }} size="large">
                      <CloseIcon />
                    </IconButton>
                  </Box>
                </DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                  {admissionDetailLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                      <CircularProgress />
                    </Box>
                  ) : !admissionDetail ? (
                    <Alert severity="error">
                      {t("common.loadError", { defaultValue: "Unable to load admission details." })}
                    </Alert>
                  ) : (
                    <Grid container spacing={3}>
                      <Grid size={{ xs: 12 }}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            {t("admissions.patientInfo", { defaultValue: "Patient Information" })}
                          </Typography>
                          <Divider sx={{ mb: 2 }} />
                          <Grid container spacing={2}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Typography variant="caption" color="text.secondary">
                                {t("admissions.patient", { defaultValue: "Patient" })}
                              </Typography>
                              <Typography variant="body1" fontWeight={500}>
                                {admissionDetail.patient_name || "-"}
                              </Typography>
                            </Grid>
                            {admissionDetail.patient_code && (
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {t("admissions.patientCode", { defaultValue: "Patient Code" })}
                                </Typography>
                                <Typography variant="body1">{admissionDetail.patient_code}</Typography>
                              </Grid>
                            )}
                          </Grid>
                        </Paper>
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            {t("admissions.admissionInfo", { defaultValue: "Admission Information" })}
                          </Typography>
                          <Divider sx={{ mb: 2 }} />
                          <Grid container spacing={2}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Typography variant="caption" color="text.secondary">
                                {t("admissions.admitDatetime", { defaultValue: "Admit Date & Time" })}
                              </Typography>
                              <Typography variant="body1">
                                {admissionDetail.admit_datetime
                                  ? new Date(admissionDetail.admit_datetime).toLocaleString(undefined, {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  : "-"}
                              </Typography>
                            </Grid>
                            {admissionDetail.discharge_datetime && (
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {t("admissions.dischargeDatetime", { defaultValue: "Discharge Date & Time" })}
                                </Typography>
                                <Typography variant="body1">
                                  {new Date(admissionDetail.discharge_datetime).toLocaleString(undefined, {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </Typography>
                              </Grid>
                            )}
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Typography variant="caption" color="text.secondary">
                                {t("admissions.status", { defaultValue: "Status" })}
                              </Typography>
                              <Box sx={{ mt: 0.5 }}>
                                <Chip
                                  label={admissionDetail.status}
                                  size="small"
                                  color={admissionDetail.status === "ACTIVE" ? "primary" : admissionDetail.status === "DISCHARGED" ? "success" : "default"}
                                  sx={{ borderRadius: 2 }}
                                />
                              </Box>
                            </Grid>
                            {admissionDetail.doctor_name && (
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {t("admissions.primaryDoctor", { defaultValue: "Primary Doctor" })}
                                </Typography>
                                <Typography variant="body1">{admissionDetail.doctor_name}</Typography>
                              </Grid>
                            )}
                            {admissionDetail.department && (
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {t("admissions.department", { defaultValue: "Department" })}
                                </Typography>
                                <Typography variant="body1">{admissionDetail.department}</Typography>
                              </Grid>
                            )}
                            {admissionDetail.discharge_summary && (
                              <Grid size={{ xs: 12 }}>
                                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                  {t("admissions.dischargeSummary", { defaultValue: "Discharge Summary" })}
                                </Typography>
                                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                                  {admissionDetail.discharge_summary}
                                </Typography>
                              </Grid>
                            )}
                            {admissionDetail.notes && (
                              <Grid size={{ xs: 12 }}>
                                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                  {t("admissions.notes", { defaultValue: "Notes" })}
                                </Typography>
                                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                                  {admissionDetail.notes}
                                </Typography>
                              </Grid>
                            )}
                          </Grid>
                        </Paper>
                      </Grid>
                    </Grid>
                  )}
                </DialogContent>
                <DialogActions sx={{ pr: 3, pb: 2 }}>
                  <Button onClick={() => {
                    setAdmissionDetailDialogOpen(false);
                    setSelectedAdmissionId(null);
                  }}>
                    {t("common.close", { defaultValue: "Close" })}
                  </Button>
                </DialogActions>
              </Dialog>
            </>
          )}
        </>
      )}
    </Box>
  );
};

export default PatientDetailPage;

