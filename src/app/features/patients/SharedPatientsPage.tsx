// src/app/features/patients/SharedPatientsPage.tsx
import React from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  CircularProgress,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Divider,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  Visibility as VisibilityIcon,
  Block as BlockIcon,
  Share as ShareIcon,
  Inbox as EmptyIcon,
  Person as PersonIcon,
  Info as InfoIcon,
  PersonOutline as PersonOutlineIcon,
} from "@mui/icons-material";
import PageToolbar from "@app/components/common/PageToolbar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@app/components/common/ToastProvider";
import { useNavigate } from "react-router-dom";
import { AppRoutes } from "@app/routes";
import { listPatientShares, revokePatientShare, getSharedPatientByToken, getSharedPatientData, importPatientShare, PatientShareResponse } from "@app/lib/api/patientShares";
import { formatDate } from "@app/lib/dateFormat";
import ConfirmationDialog from "@app/components/common/ConfirmationDialog";
import PermissionGuard from "@app/components/common/PermissionGuard";
import { useAuthStore } from "@app/store/authStore";
import { apiClient } from "@app/lib/apiClient";

interface SharedPatientSummary {
  first_name: string;
  last_name?: string | null;
  patient_code?: string | null;
  dob?: string | null;
  gender?: string | null;
  blood_group?: string | null;
  phone_primary?: string | null;
  email?: string | null;
  city?: string | null;
  known_allergies?: string | null;
  chronic_conditions?: string | null;
  last_visits?: Array<{ date: string; type: string; department?: string | null }>;
  last_prescriptions?: Array<{ date: string; diagnosis?: string | null; medicines_count: number }>;
  recent_vitals?: Array<{
    date: string;
    time: string;
    systolic_bp?: number | null;
    diastolic_bp?: number | null;
    heart_rate?: number | null;
    temperature_c?: number | null;
    respiratory_rate?: number | null;
    spo2?: number | null;
    weight_kg?: number | null;
    height_cm?: number | null;
    notes?: string | null;
  }>;
}

const SharedPatientsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [tab, setTab] = React.useState(0);
  const [viewDialogOpen, setViewDialogOpen] = React.useState(false);
  const [selectedShare, setSelectedShare] = React.useState<PatientShareResponse | null>(null);
  const [sharedPatientData, setSharedPatientData] = React.useState<SharedPatientSummary | null>(null);
  const [revokeDialogOpen, setRevokeDialogOpen] = React.useState(false);
  const [shareToRevoke, setShareToRevoke] = React.useState<PatientShareResponse | null>(null);
  const [importDialogOpen, setImportDialogOpen] = React.useState(false);
  const [shareToImport, setShareToImport] = React.useState<PatientShareResponse | null>(null);
  const [loadingPatientData, setLoadingPatientData] = React.useState(false);

  // Get current tenant ID
  const user = useAuthStore((s) => s.user);
  const { data: tenantInfo } = useQuery({
    queryKey: ["tenant-info"],
    queryFn: async () => {
      const res = await apiClient.get("/auth/me");
      return res.data;
    },
  });
  const currentTenantId = user?.tenant_id || tenantInfo?.tenant?.id;

  // Fetch patient shares
  const { data: shares, isLoading } = useQuery({
    queryKey: ["patient-shares"],
    queryFn: () => listPatientShares(),
  });

  // Filter shares by tab
  const filteredShares = React.useMemo(() => {
    if (!shares || !currentTenantId) return [];
    if (tab === 0) {
      // Outgoing - shares created by this tenant (source_tenant_id matches current tenant)
      return shares.filter((share) => share.source_tenant_id === currentTenantId);
    } else {
      // Incoming - shares received by this tenant (target_tenant_id matches current tenant)
      return shares.filter((share) => share.target_tenant_id === currentTenantId);
    }
  }, [shares, tab, currentTenantId]);

  const viewMutation = useMutation({
    mutationFn: async ({ shareId, token }: { shareId?: string; token?: string }) => {
      if (token) {
        return await getSharedPatientByToken(token);
      } else if (shareId) {
        return await getSharedPatientData(shareId);
      }
      throw new Error("Either shareId or token must be provided");
    },
    onSuccess: (data) => {
      setSharedPatientData(data);
      setLoadingPatientData(false);
    },
    onError: (error: any) => {
      showError(
        error?.response?.data?.detail ||
          t("patients.shareViewError", {
            defaultValue: "Failed to load shared patient data",
          })
      );
      setLoadingPatientData(false);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (shareId: string) => {
      return await revokePatientShare(shareId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-shares"] });
      showSuccess(
        t("patients.shareRevoked", {
          defaultValue: "Patient share revoked successfully",
        })
      );
      setRevokeDialogOpen(false);
      setShareToRevoke(null);
    },
    onError: (error: any) => {
      showError(
        error?.response?.data?.detail ||
          t("patients.shareRevokeError", {
            defaultValue: "Failed to revoke patient share",
          })
      );
    },
  });

  const importMutation = useMutation({
    mutationFn: async (shareId: string) => {
      return await importPatientShare(shareId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["patient-shares"] });
      
      // Get share details for success message
      const share = shareToImport;
      const patientName = share?.patient_name || "Patient";
      const patientCode = share?.patient_code || "N/A";
      const sourceHospital = share?.source_tenant_name || "source hospital";
      const newPatientId = data.target_patient_id?.substring(0, 8) || "N/A";
      
      showSuccess(
        t("patients.importSuccessDetailed", {
          defaultValue: `Patient record "${patientName}" (${patientCode}) has been successfully imported from ${sourceHospital}. A new patient record has been created in your hospital system with patient information and vitals. Patient ID: ${newPatientId}...`,
          patientName,
          patientCode,
          sourceHospital,
          newPatientId,
        })
      );
      setImportDialogOpen(false);
      setShareToImport(null);
    },
    onError: (error: any) => {
      showError(
        error?.response?.data?.detail ||
          t("patients.importError", {
            defaultValue: "Failed to import patient record",
          })
      );
    },
  });

  const handleViewShareDetails = (share: PatientShareResponse) => {
    setSelectedShare(share);
    setViewDialogOpen(true);
    setLoadingPatientData(false);
    setSharedPatientData(null);
  };

  const handleViewSharedPatientData = (share: PatientShareResponse) => {
    // Check if share is revoked or expired
    if (share.status !== "ACTIVE" || (share.expires_at && new Date(share.expires_at) < new Date())) {
      showError(
        t("patients.shareNotActive", {
          defaultValue: "This share is no longer active. You cannot view patient details.",
        })
      );
      return;
    }
    
    setSelectedShare(share);
    setViewDialogOpen(true);
    setLoadingPatientData(true);
    
    // Use token for READ_ONLY_LINK, shareId for CREATE_RECORD
    if (share.share_mode === "READ_ONLY_LINK" && share.token) {
      viewMutation.mutate({ token: share.token });
    } else {
      viewMutation.mutate({ shareId: share.id });
    }
  };

  const handleImportPatient = (share: PatientShareResponse) => {
    setShareToImport(share);
    setImportDialogOpen(true);
  };

  const handleRevokeShare = (share: PatientShareResponse) => {
    setShareToRevoke(share);
    setRevokeDialogOpen(true);
  };

  const confirmRevoke = () => {
    if (shareToRevoke) {
      revokeMutation.mutate(shareToRevoke.id);
    }
  };

  const confirmImport = () => {
    if (shareToImport) {
      importMutation.mutate(shareToImport.id);
    }
  };

  const getStatusColor = (status: string): "default" | "success" | "error" | "warning" => {
    switch (status) {
      case "ACTIVE":
        return "success";
      case "REVOKED":
        return "error";
      case "EXPIRED":
        return "warning";
      default:
        return "default";
    }
  };

  const isShareExpired = (share: PatientShareResponse): boolean => {
    if (share.status === "EXPIRED") return true;
    if (share.expires_at) {
      return new Date(share.expires_at) < new Date();
    }
    return false;
  };

  return (
    <Box>
      <PageToolbar
        title={t("patients.sharedPatients", { defaultValue: "Shared Patients" })}
        subtitle={t("patients.sharedPatientsSubtitle", {
          defaultValue: "View and manage patient records shared with other hospitals",
        })}
        titleIcon={<ShareIcon sx={{ fontSize: 32 }} />}
      />

      <Paper
        elevation={2}
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          border: "1px solid rgba(0, 0, 0, 0.05)",
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          <Tab
            label={t("patients.outgoingShares", {
              defaultValue: "Outgoing Shares",
            })}
          />
          <Tab
            label={t("patients.incomingShares", {
              defaultValue: "Incoming Shares",
            })}
          />
        </Tabs>

        {isLoading ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    {tab === 0
                      ? t("patients.targetHospital", {
                          defaultValue: "Target Hospital",
                        })
                      : t("patients.sourceHospital", {
                          defaultValue: "Source Hospital",
                        })}
                  </TableCell>
                  <TableCell>
                    {t("patients.patient", { defaultValue: "Patient" })}
                  </TableCell>
                  <TableCell>
                    {t("patients.sharedBy", { defaultValue: "Shared By" })}
                  </TableCell>
                  <TableCell>
                    {t("patients.shareMode", { defaultValue: "Share Mode" })}
                  </TableCell>
                  <TableCell>
                    {t("patients.status", { defaultValue: "Status" })}
                  </TableCell>
                  <TableCell>
                    {t("patients.expiresAt", { defaultValue: "Expires At" })}
                  </TableCell>
                  <TableCell>
                    {t("patients.createdAt", { defaultValue: "Created At" })}
                  </TableCell>
                  <TableCell align="right">
                    {t("common.actions", { defaultValue: "Actions" })}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredShares.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                      <EmptyIcon
                        sx={{
                          fontSize: 64,
                          color: "text.secondary",
                          mb: 2,
                          opacity: 0.5,
                        }}
                      />
                      <Typography
                        variant="h6"
                        color="text.secondary"
                        sx={{ mb: 1 }}
                      >
                        {t("patients.noShares", {
                          defaultValue: "No patient shares found",
                        })}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t("patients.noSharesDescription", {
                          defaultValue:
                            tab === 0
                              ? "You haven't shared any patient records yet."
                              : "No patient records have been shared with you yet.",
                        })}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredShares.map((share) => (
                    <TableRow key={share.id} hover>
                      <TableCell>
                        {tab === 0
                          ? share.target_tenant_name || "-"
                          : share.source_tenant_name || "-"}
                      </TableCell>
                      <TableCell>
                        {share.patient_name || "-"}
                        {share.patient_code && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            ({share.patient_code})
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {share.created_by_user_name || "-"}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={
                            share.share_mode === "READ_ONLY_LINK"
                              ? t("patients.readOnlyLink", {
                                  defaultValue: "Read-only Link",
                                })
                              : t("patients.createRecord", {
                                  defaultValue: "Create Record",
                                })
                          }
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={share.status}
                          size="small"
                          color={getStatusColor(share.status)}
                        />
                        {isShareExpired(share) && (
                          <Chip
                            label={t("patients.expired", {
                              defaultValue: "Expired",
                            })}
                            size="small"
                            color="warning"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {share.expires_at
                          ? formatDate(share.expires_at)
                          : t("common.never", { defaultValue: "Never" })}
                      </TableCell>
                      <TableCell>{formatDate(share.created_at)}</TableCell>
                      <TableCell align="right">
                        <Box
                          sx={{
                            display: "flex",
                            gap: 1,
                            justifyContent: "flex-end",
                          }}
                        >
                          {/* View Shared - Always available */}
                          <Tooltip title={t("patients.viewShareDetails", { defaultValue: "View Shared" })}>
                            <IconButton
                              size="small"
                              onClick={() => handleViewShareDetails(share)}
                            >
                              <InfoIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          
                          {/* View Patient - Shows all shared data (appointments, prescriptions, etc.) - Available for both READ_ONLY_LINK and CREATE_RECORD */}
                          {share.status === "ACTIVE" &&
                            !isShareExpired(share) && (
                              <PermissionGuard permission="patients:view">
                                <Tooltip 
                                  title={t("patients.viewSharedPatientData", { 
                                    defaultValue: "View Patient - View all shared patient data including appointments, prescriptions, admissions, and vitals from the source hospital" 
                                  })}
                                >
                                  <IconButton
                                    size="small"
                                    onClick={() => handleViewSharedPatientData(share)}
                                    disabled={loadingPatientData}
                                  >
                                    <VisibilityIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </PermissionGuard>
                            )}
                          
                          {/* Import OR View Imported Patient Detail - For incoming CREATE_RECORD shares */}
                          {tab === 1 && share.share_mode === "CREATE_RECORD" && (
                            <>
                              {/* Import - If not yet imported, only show when share is active and not expired */}
                              {!share.target_patient_id &&
                                share.status === "ACTIVE" &&
                                !isShareExpired(share) && (
                                  <Tooltip title={t("patients.importPatient", { defaultValue: "Import Patient Record" })}>
                                    <IconButton
                                      size="small"
                                      onClick={() => handleImportPatient(share)}
                                      disabled={importMutation.isPending}
                                      color="primary"
                                    >
                                      <PersonIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              
                              {/* View Imported Patient Detail - If already imported, show even if revoked/expired - Shows imported patient record in target hospital */}
                              {share.target_patient_id && (
                                <PermissionGuard permission="patients:view">
                                  <Tooltip 
                                    title={t("patients.viewImportedPatientDetail", { 
                                      defaultValue: "View Imported Patient Detail - View the imported patient record in your hospital system" 
                                    })}
                                  >
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        navigate(`${AppRoutes.PATIENT_DETAIL.replace(":id", share.target_patient_id!)}`);
                                      }}
                                    >
                                      <PersonOutlineIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </PermissionGuard>
                              )}
                            </>
                          )}
                          
                          {/* Revoke - Only for outgoing active shares */}
                          {tab === 0 &&
                            share.status === "ACTIVE" &&
                            !isShareExpired(share) && (
                              <PermissionGuard permission="sharing:create">
                                <Tooltip title={t("patients.revokeShare", { defaultValue: "Revoke share" })}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleRevokeShare(share)}
                                    disabled={revokeMutation.isPending}
                                    color="error"
                                  >
                                    <BlockIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </PermissionGuard>
                            )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* View Shared Patient Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => {
          setViewDialogOpen(false);
          setSelectedShare(null);
          setSharedPatientData(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {sharedPatientData
            ? t("patients.sharedPatientDetails", {
                defaultValue: "Shared Patient Details",
              })
            : t("patients.shareDetails", {
                defaultValue: "Share Details",
              })}
        </DialogTitle>
        <DialogContent>
          {loadingPatientData ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : !sharedPatientData ? (
            <Box sx={{ pt: 1 }}>
              {selectedShare?.share_mode === "CREATE_RECORD" && selectedShare.target_patient_id && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {t("patients.patientImportedSuccess", {
                    defaultValue: `Patient record has been successfully imported from ${selectedShare.source_tenant_name || "source hospital"}.`,
                    sourceHospital: selectedShare.source_tenant_name || "source hospital",
                  })}
                </Alert>
              )}
              
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="h6" gutterBottom>
                    {t("patients.shareInformation", { defaultValue: "Share Information" })}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                </Grid>
                
                {selectedShare?.patient_name && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t("patients.patient", { defaultValue: "Patient" })}
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {selectedShare.patient_name}
                      {selectedShare.patient_code && ` (${selectedShare.patient_code})`}
                    </Typography>
                  </Grid>
                )}
                
                {selectedShare?.created_by_user_name && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t("patients.sharedBy", { defaultValue: "Shared By" })}
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {selectedShare.created_by_user_name}
                    </Typography>
                  </Grid>
                )}
                
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("patients.sourceHospital", { defaultValue: "Source Hospital" })}
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {selectedShare?.source_tenant_name || "-"}
                  </Typography>
                </Grid>
                
                {selectedShare?.target_tenant_name && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t("patients.targetHospital", { defaultValue: "Target Hospital" })}
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {selectedShare.target_tenant_name}
                    </Typography>
                  </Grid>
                )}
                
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("patients.shareMode", { defaultValue: "Share Mode" })}
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {selectedShare?.share_mode === "CREATE_RECORD"
                      ? t("patients.createRecord", { defaultValue: "Create Record" })
                      : t("patients.readOnlyLink", { defaultValue: "Read-only Link" })}
                  </Typography>
                </Grid>
                
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("patients.status", { defaultValue: "Status" })}
                  </Typography>
                  <Chip
                    label={selectedShare?.status}
                    size="small"
                    color={getStatusColor(selectedShare?.status || "ACTIVE")}
                  />
                </Grid>
                
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("patients.createdAt", { defaultValue: "Created At" })}
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {selectedShare?.created_at ? formatDate(selectedShare.created_at) : "-"}
                  </Typography>
                </Grid>
                
                {selectedShare?.expires_at && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t("patients.expiresAt", { defaultValue: "Expires At" })}
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {formatDate(selectedShare.expires_at)}
                    </Typography>
                  </Grid>
                )}
                
                {selectedShare?.revoked_at && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t("patients.revokedAt", { defaultValue: "Revoked At" })}
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {formatDate(selectedShare.revoked_at)}
                    </Typography>
                  </Grid>
                )}
                
                {selectedShare?.note && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t("patients.note", { defaultValue: "Note" })}
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {selectedShare.note}
                    </Typography>
                  </Grid>
                )}
                
                {selectedShare?.target_patient_id && (
                  <Grid size={{ xs: 12 }}>
                    <Button
                      variant="contained"
                      startIcon={<PersonIcon />}
                      onClick={() => {
                        setViewDialogOpen(false);
                        navigate(`${AppRoutes.PATIENT_DETAIL.replace(":id", selectedShare.target_patient_id!)}`);
                      }}
                      sx={{ mt: 2 }}
                    >
                      {t("patients.viewImportedPatient", {
                        defaultValue: "View Imported Patient Record",
                      })}
                    </Button>
                  </Grid>
                )}
              </Grid>
            </Box>
          ) : sharedPatientData ? (
            <Box sx={{ pt: 1 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                {t("patients.sharedPatientInfo", {
                  defaultValue:
                    "This is a read-only view of a patient record shared from another hospital.",
                })}
              </Alert>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="h6" gutterBottom>
                    {t("patients.basicInfo", { defaultValue: "Basic Information" })}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t("patients.name", { defaultValue: "Name" })}
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {sharedPatientData.first_name}{" "}
                    {sharedPatientData.last_name || ""}
                  </Typography>
                </Grid>

                {sharedPatientData.patient_code && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t("patients.patientCode", { defaultValue: "Patient Code" })}
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {sharedPatientData.patient_code}
                    </Typography>
                  </Grid>
                )}

                {sharedPatientData.dob && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t("patients.dateOfBirth", { defaultValue: "Date of Birth" })}
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {formatDate(sharedPatientData.dob)}
                    </Typography>
                  </Grid>
                )}

                {sharedPatientData.gender && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t("patients.gender", { defaultValue: "Gender" })}
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {sharedPatientData.gender}
                    </Typography>
                  </Grid>
                )}

                {sharedPatientData.blood_group && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t("patients.bloodGroup", { defaultValue: "Blood Group" })}
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {sharedPatientData.blood_group}
                    </Typography>
                  </Grid>
                )}

                {sharedPatientData.phone_primary && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t("patients.phone", { defaultValue: "Phone" })}
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {sharedPatientData.phone_primary}
                    </Typography>
                  </Grid>
                )}

                {sharedPatientData.email && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t("patients.email", { defaultValue: "Email" })}
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {sharedPatientData.email}
                    </Typography>
                  </Grid>
                )}

                {sharedPatientData.city && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t("patients.city", { defaultValue: "City" })}
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {sharedPatientData.city}
                    </Typography>
                  </Grid>
                )}

                {sharedPatientData.known_allergies && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t("patients.knownAllergies", {
                        defaultValue: "Known Allergies",
                      })}
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {sharedPatientData.known_allergies}
                    </Typography>
                  </Grid>
                )}

                {sharedPatientData.chronic_conditions && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t("patients.chronicConditions", {
                        defaultValue: "Chronic Conditions",
                      })}
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {sharedPatientData.chronic_conditions}
                    </Typography>
                  </Grid>
                )}

                {sharedPatientData.last_visits &&
                  sharedPatientData.last_visits.length > 0 && (
                    <>
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                          {t("patients.recentVisits", {
                            defaultValue: "Recent Visits",
                          })}
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                      </Grid>
                      {sharedPatientData.last_visits.map((visit, idx) => (
                        <Grid size={{ xs: 12 }} key={idx}>
                          <Typography variant="body2">
                            {formatDate(visit.date)} - {visit.type}
                            {visit.department && ` - ${visit.department}`}
                          </Typography>
                        </Grid>
                      ))}
                    </>
                  )}

                {sharedPatientData.last_prescriptions &&
                  sharedPatientData.last_prescriptions.length > 0 && (
                    <>
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                          {t("patients.recentPrescriptions", {
                            defaultValue: "Recent Prescriptions",
                          })}
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                      </Grid>
                      {sharedPatientData.last_prescriptions.map(
                        (prescription, idx) => (
                          <Grid size={{ xs: 12 }} key={idx}>
                            <Typography variant="body2">
                              {formatDate(prescription.date)} -{" "}
                              {prescription.diagnosis || t("common.none", { defaultValue: "No diagnosis" })}{" "}
                              ({prescription.medicines_count}{" "}
                              {t("patients.medicines", { defaultValue: "medicines" })})
                            </Typography>
                          </Grid>
                        )
                      )}
                    </>
                  )}

                {sharedPatientData.recent_vitals &&
                  sharedPatientData.recent_vitals.length > 0 && (
                    <>
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                          {t("patients.recentVitals", {
                            defaultValue: "Recent Vitals",
                          })}
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                      </Grid>
                      {sharedPatientData.recent_vitals.map((vital, idx) => (
                        <Grid size={{ xs: 12 }} key={idx}>
                          <Box
                            sx={{
                              p: 1.5,
                              mb: 1,
                              border: "1px solid",
                              borderColor: "divider",
                              borderRadius: 1,
                            }}
                          >
                            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                              {formatDate(vital.date)} {vital.time && `at ${vital.time}`}
                            </Typography>
                            <Box
                              sx={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 2,
                                mt: 1,
                              }}
                            >
                              {vital.systolic_bp !== null &&
                                vital.systolic_bp !== undefined &&
                                vital.diastolic_bp !== null &&
                                vital.diastolic_bp !== undefined && (
                                  <Typography variant="body2">
                                    <strong>BP:</strong> {vital.systolic_bp}/{vital.diastolic_bp} mmHg
                                  </Typography>
                                )}
                              {vital.heart_rate !== null &&
                                vital.heart_rate !== undefined && (
                                  <Typography variant="body2">
                                    <strong>HR:</strong> {vital.heart_rate} bpm
                                  </Typography>
                                )}
                              {vital.temperature_c !== null &&
                                vital.temperature_c !== undefined && (
                                  <Typography variant="body2">
                                    <strong>Temp:</strong> {vital.temperature_c}°C
                                  </Typography>
                                )}
                              {vital.respiratory_rate !== null &&
                                vital.respiratory_rate !== undefined && (
                                  <Typography variant="body2">
                                    <strong>RR:</strong> {vital.respiratory_rate} /min
                                  </Typography>
                                )}
                              {vital.spo2 !== null && vital.spo2 !== undefined && (
                                <Typography variant="body2">
                                  <strong>SpO2:</strong> {vital.spo2}%
                                </Typography>
                              )}
                              {vital.weight_kg !== null &&
                                vital.weight_kg !== undefined && (
                                  <Typography variant="body2">
                                    <strong>Weight:</strong> {vital.weight_kg} kg
                                  </Typography>
                                )}
                              {vital.height_cm !== null &&
                                vital.height_cm !== undefined && (
                                  <Typography variant="body2">
                                    <strong>Height:</strong> {vital.height_cm} cm
                                  </Typography>
                                )}
                            </Box>
                            {vital.notes && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mt: 1, fontStyle: "italic" }}
                              >
                                {vital.notes}
                              </Typography>
                            )}
                          </Box>
                        </Grid>
                      ))}
                    </>
                  )}
              </Grid>
            </Box>
          ) : (
            <Typography color="text.secondary">
              {t("patients.noDataAvailable", {
                defaultValue: "No data available",
              })}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setViewDialogOpen(false);
              setSelectedShare(null);
              setSharedPatientData(null);
            }}
          >
            {t("common.close", { defaultValue: "Close" })}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Revoke Share Confirmation Dialog */}
      <ConfirmationDialog
        open={revokeDialogOpen}
        onClose={() => {
          setRevokeDialogOpen(false);
          setShareToRevoke(null);
        }}
        onConfirm={confirmRevoke}
        title={t("patients.revokeShareTitle", {
          defaultValue: "Revoke Patient Share",
        })}
        message={t("patients.revokeShareConfirm", {
          defaultValue:
            "Are you sure you want to revoke this patient share? The recipient will no longer be able to access the shared patient data.",
        })}
        confirmText={t("patients.revoke", { defaultValue: "Revoke" })}
        confirmColor="error"
        isLoading={revokeMutation.isPending}
      />

      {/* Import Patient Confirmation Dialog */}
      <ConfirmationDialog
        open={importDialogOpen}
        onClose={() => {
          setImportDialogOpen(false);
          setShareToImport(null);
        }}
        onConfirm={confirmImport}
        title={t("patients.importPatientTitle", {
          defaultValue: "Import Patient Record",
        })}
        message={
          shareToImport
            ? t("patients.importPatientConfirmDetailed", {
                defaultValue: `Are you sure you want to import the patient record "${shareToImport.patient_name || "Patient"}" (${shareToImport.patient_code || "N/A"}) from ${shareToImport.source_tenant_name || "source hospital"}? A new patient record will be created in your hospital system with the patient's information and vitals. Visit history (appointments, prescriptions, admissions) from the source hospital will not be imported.`,
                patientName: shareToImport.patient_name || "Patient",
                patientCode: shareToImport.patient_code || "N/A",
                sourceHospital: shareToImport.source_tenant_name || "source hospital",
              })
            : t("patients.importPatientConfirm", {
                defaultValue:
                  "Are you sure you want to import this patient record? A new patient record will be created in your hospital system with the patient's information and vitals. Visit history (appointments, prescriptions, admissions) from the source hospital will not be imported.",
              })
        }
        confirmText={t("patients.import", { defaultValue: "Import" })}
        confirmColor="primary"
        isLoading={importMutation.isPending}
      />
    </Box>
  );
};

export default SharedPatientsPage;

