// src/app/features/tenants/TenantRegisterPage.tsx
import React from "react";
import {
  Box,
  Button,
  Stack,
  TextField,
  Alert,
  Typography,
  Tooltip,
} from "@mui/material";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiClient } from "@app/lib/apiClient";
import { useNavigate } from "react-router-dom";
import { AppRoutes } from "@app/routes";
import { useTranslation } from "react-i18next";

const hospitalNameRegex = /^[A-Za-z0-9\- ]+$/;
const phoneRegex = /^[0-9+\-\s]{5,15}$/;

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(5, "Hospital name must be at least 5 characters")
    .regex(
      hospitalNameRegex,
      "Hospital name can contain letters, numbers, spaces and dashes only"
    ),
  address: z
    .string()
    .trim()
    .min(1, "Address is required"),
  contact_email: z
    .string()
    .trim()
    .min(1, "Contact email is required")
    .email("Enter a valid email address"),
  contact_phone: z
    .string()
    .trim()
    .refine((val) => phoneRegex.test(val), {
      message:
        "Phone must be 10–15 characters and contain only digits, spaces, + or -",
    }),
  license_number: z
    .string()
    .trim()
    .min(3, "License number is required"),
});

type FormValues = z.infer<typeof schema>;

const TenantRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const hasErrors = Object.keys(errors).length > 0;

  const onSubmit = async (values: FormValues) => {
    setError(null);
    setSuccessMsg(null);
    try {
      const payload = {
        ...values,
        name: values.name.trim(),
        address: values.address.trim(),
        contact_email: values.contact_email.trim(),
        contact_phone: values.contact_phone.trim(),
        license_number: values.license_number.trim(),
      };

      const res = await apiClient.post("/tenants/register", payload);
      const data = res.data as {
        admin_email?: string;
        admin_temp_password?: string;
      };

      const msg = t("tenant.registerSuccess", {
        defaultValue:
          "Hospital registered successfully.\nAdmin Email: {{email}}\nTemporary Password: {{password}}",
        email: data.admin_email ?? "-",
        password: data.admin_temp_password ?? "-",
      });

      // Redirect immediately to login page with success message
      navigate(AppRoutes.LOGIN, {
        state: { 
          message: msg,
          messageType: "success"
        }
      });
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ??
          t(
            "tenant.registerError",
            "Failed to register hospital. Please try again."
          )
      );
    }
  };

  return (
    <Box>
      <Typography variant="h5" mb={2} fontWeight={600}>
        {t("tenant.registerTitle")}
      </Typography>
      <Typography variant="body2" mb={2} color="text.secondary">
        {t("tenant.registerSubtitle")}
      </Typography>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2.5}>
          {error && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {error}
            </Alert>
          )}
          {successMsg && (
            <Alert severity="success" sx={{ borderRadius: 2, whiteSpace: "pre-line" }}>
              {successMsg}
            </Alert>
          )}

          <TextField
            label={t("tenant.name", "Hospital Name")}
            fullWidth
            required
            {...register("name")}
            error={!!errors.name}
            helperText={errors.name?.message}
            size="medium"
          />
          <TextField
            label={t("tenant.address", "Address")}
            fullWidth
            required
            multiline
            minRows={2}
            {...register("address")}
            error={!!errors.address}
            helperText={errors.address?.message}
            size="medium"
          />
          <TextField
            label={t("tenant.contactEmail", "Contact Email")}
            fullWidth
            required
            type="email"
            {...register("contact_email")}
            error={!!errors.contact_email}
            helperText={errors.contact_email?.message}
            size="medium"
          />
          <TextField
            label={t("tenant.contactPhone", "Contact Phone")}
            fullWidth
            required
            {...register("contact_phone")}
            error={!!errors.contact_phone}
            helperText={errors.contact_phone?.message}
            size="medium"
          />
          <TextField
            label={t("tenant.licenseNumber", "License Number")}
            fullWidth
            required
            {...register("license_number")}
            error={!!errors.license_number}
            helperText={errors.license_number?.message}
            size="medium"
          />

          <Stack direction="row" spacing={2} justifyContent="space-between">
            <Button
              type="button"
              variant="text"
              onClick={() => navigate(AppRoutes.LOGIN)}
            >
              {t("tenant.backToLogin", "Back to Login")}
            </Button>
            <Tooltip
              title={
                !isValid
                  ? hasErrors
                    ? t("auth.form.hasErrors", {
                        defaultValue: "Please fix the errors in the form",
                      })
                    : t("auth.form.incomplete", {
                        defaultValue: "Please complete all required fields",
                      })
                  : ""
              }
              arrow
            >
              <span>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isSubmitting || !isValid}
                >
                  {isSubmitting
                    ? t("common.saving", { defaultValue: "Registering..." })
                    : t("tenant.registerCta", "Register")}
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
};

export default TenantRegisterPage;