import React from "react";
import {
  Box,
  Button,
  Stack,
  TextField,
  Alert,
  Typography
} from "@mui/material";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiClient } from "@app/lib/apiClient";
import { useNavigate } from "react-router-dom";
import { AppRoutes } from "@app/routes";

const schema = z.object({
  name: z.string().min(1, "Hospital name is required"),
  address: z.string().min(1, "Address is required"),
  contact_email: z.string().email("Valid email is required"),
  contact_phone: z.string().min(5, "Phone is required"),
  license_number: z.string().min(3, "License number is required")
});

type FormValues = z.infer<typeof schema>;

const TenantRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await apiClient.post("/tenants/register", values);
      const data = res.data as {
        admin_email?: string;
        admin_temp_password?: string;
      };

      const msg = `Hospital registered successfully.
Admin Email: ${data.admin_email ?? "-"}
Temporary Password: ${data.admin_temp_password ?? "-"}`;

      setSuccessMsg(msg);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ??
          "Failed to register hospital. Please try again."
      );
    }
  };

  return (
    <Box>
      <Typography variant="h5" mb={2} fontWeight={600}>
        Register Hospital
      </Typography>
      <Typography variant="body2" mb={2} color="text.secondary">
        Self-onboard your hospital. After registration, use the admin credentials
        to log in and configure users.
      </Typography>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2}>
          {successMsg && <Alert severity="success">{successMsg}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Hospital Name"
            fullWidth
            {...register("name")}
            error={!!errors.name}
            helperText={errors.name?.message}
          />
          <TextField
            label="Address"
            fullWidth
            multiline
            minRows={2}
            {...register("address")}
            error={!!errors.address}
            helperText={errors.address?.message}
          />
          <TextField
            label="Contact Email"
            fullWidth
            {...register("contact_email")}
            error={!!errors.contact_email}
            helperText={errors.contact_email?.message}
          />
          <TextField
            label="Contact Phone"
            fullWidth
            {...register("contact_phone")}
            error={!!errors.contact_phone}
            helperText={errors.contact_phone?.message}
          />
          <TextField
            label="License Number"
            fullWidth
            {...register("license_number")}
            error={!!errors.license_number}
            helperText={errors.license_number?.message}
          />

          <Stack direction="row" spacing={2} justifyContent="space-between">
            <Button
              type="button"
              variant="text"
              onClick={() => navigate(AppRoutes.LOGIN)}
            >
              Back to Login
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
            >
              Register
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
};

export default TenantRegisterPage;