// src/app/features/sharing/SharingPage.tsx
import React from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Tabs,
  Tab,
} from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@app/lib/apiClient";
import { useTranslation } from "react-i18next";
import { useToast } from "@app/components/common/ToastProvider";
import PermissionGuard from "@app/components/common/PermissionGuard";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface Tenant {
  id: string;
  name: string;
  contact_email: string;
}

interface SharingRequest {
  id: string;
  from_tenant_id: string;
  to_tenant_id: string;
  patient_global_id: string;
  reason?: string | null;
  status: string;
  created_at: string;
}

const fetchTenants = async (): Promise<Tenant[]> => {
  const res = await apiClient.get<Tenant[]>("/sharing/tenants");
  return res.data;
};

const fetchSharingRequests = async (direction: string): Promise<SharingRequest[]> => {
  const res = await apiClient.get<SharingRequest[]>(`/sharing?direction=${direction}`);
  return res.data;
};

const schema = z.object({
  to_tenant_id: z.string().min(1, "Hospital is required"),
  patient_global_id: z.string().min(1, "Patient Global ID is required"),
  reason: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const SharingPage: React.FC = () => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState(0);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const { data: tenants } = useQuery({
    queryKey: ["sharing-tenants"],
    queryFn: fetchTenants,
  });

  const { data: outgoingRequests, isLoading: outgoingLoading } = useQuery({
    queryKey: ["sharing-requests", "outgoing"],
    queryFn: () => fetchSharingRequests("outgoing"),
  });

  const { data: incomingRequests, isLoading: incomingLoading } = useQuery({
    queryKey: ["sharing-requests", "incoming"],
    queryFn: () => fetchSharingRequests("incoming"),
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      await apiClient.post("/sharing", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sharing-requests"] });
      showSuccess(t("notifications.sharingCreated", { defaultValue: "Sharing request created successfully" }));
      setDialogOpen(false);
    },
    onError: (error: any) => {
      showError(
        error?.response?.data?.detail || 
        t("notifications.sharingCreateError", { defaultValue: "Failed to create sharing request" })
      );
    },
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    reset();
  };

  const onSubmit = (data: FormValues) => {
    createMutation.mutate(data);
  };

  const requests = tab === 0 ? outgoingRequests : incomingRequests;
  const isLoading = tab === 0 ? outgoingLoading : incomingLoading;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={600}>
          {t("sharing.title", { defaultValue: "Patient Sharing" })}
        </Typography>
        <PermissionGuard permission="sharing:create">
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            {t("sharing.sharePatient", { defaultValue: "Share Patient Record" })}
          </Button>
        </PermissionGuard>
      </Box>

      <Paper elevation={2} sx={{ borderRadius: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tab label={t("sharing.outgoing", { defaultValue: "Outgoing Requests" })} />
          <Tab label={t("sharing.incoming", { defaultValue: "Incoming Requests" })} />
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
                      ? t("sharing.toHospital", { defaultValue: "To Hospital" })
                      : t("sharing.fromHospital", { defaultValue: "From Hospital" })}
                  </TableCell>
                  <TableCell>{t("sharing.patientId", { defaultValue: "Patient Global ID" })}</TableCell>
                  <TableCell>{t("sharing.reason", { defaultValue: "Reason" })}</TableCell>
                  <TableCell>{t("sharing.status", { defaultValue: "Status" })}</TableCell>
                  <TableCell>{t("sharing.createdAt", { defaultValue: "Created At" })}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requests && requests.length > 0 ? (
                  requests.map((req) => (
                    <TableRow key={req.id} hover>
                      <TableCell>
                        {tenants?.find((t) => t.id === (tab === 0 ? req.to_tenant_id : req.from_tenant_id))?.name || "-"}
                      </TableCell>
                      <TableCell>{req.patient_global_id}</TableCell>
                      <TableCell>{req.reason || "-"}</TableCell>
                      <TableCell>
                        <Chip
                          label={req.status}
                          size="small"
                          color={
                            req.status === "APPROVED"
                              ? "success"
                              : req.status === "REJECTED"
                              ? "error"
                              : "default"
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(req.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        {t("sharing.empty", { defaultValue: "No sharing requests found." })}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {t("sharing.sharePatient", { defaultValue: "Share Patient Record" })}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
              <Controller
                name="to_tenant_id"
                control={control}
                render={({ field }) => (
                  <FormControl error={!!errors.to_tenant_id} fullWidth>
                    <InputLabel>{t("sharing.toHospital", { defaultValue: "To Hospital" })}</InputLabel>
                    <Select {...field} label={t("sharing.toHospital", { defaultValue: "To Hospital" })}>
                      {tenants?.map((tenant) => (
                        <MenuItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />

              <Controller
                name="patient_global_id"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label={t("sharing.patientId", { defaultValue: "Patient Global ID" })}
                    error={!!errors.patient_global_id}
                    helperText={errors.patient_global_id?.message}
                    fullWidth
                  />
                )}
              />

              <Controller
                name="reason"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label={t("sharing.reason", { defaultValue: "Reason for Sharing" })}
                    multiline
                    rows={3}
                    error={!!errors.reason}
                    helperText={errors.reason?.message}
                    fullWidth
                  />
                )}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending
                ? t("common.saving", { defaultValue: "Saving..." })
                : t("sharing.createRequest", { defaultValue: "Create Request" })}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default SharingPage;

