// src/app/features/auth/ForgotPasswordPage.tsx
import React from "react";
import {
  Box,
  Button,
  TextField,
  Stack,
  Alert,
  Typography,
  Paper,
} from "@mui/material";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "@app/lib/apiClient";
import { useNavigate } from "react-router-dom";
import { AppRoutes } from "@app/routes";
import { useTranslation } from "react-i18next";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
});

type FormValues = z.infer<typeof schema>;

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post("/auth/forgot-password", {
        email: values.email.trim(),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ??
          t("auth.forgotPassword.error", {
            defaultValue: "Failed to send reset email. Please try again.",
          })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <Box sx={{ maxWidth: 500, mx: "auto", py: 2 }}>
        <Paper elevation={2} sx={{ p: 4, borderRadius: 3 }}>
          <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
            {t("auth.forgotPassword.success", {
              defaultValue:
                "If an account exists with this email, a password reset link has been sent. Please check your inbox.",
            })}
          </Alert>
          <Button
            variant="contained"
            fullWidth
            onClick={() => navigate(AppRoutes.LOGIN)}
            sx={{ borderRadius: 2 }}
          >
            {t("auth.backToLogin", { defaultValue: "Back to Login" })}
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 500, mx: "auto", py: 2 }}>
      <Paper elevation={2} sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h5" fontWeight={600} sx={{ mb: 1 }}>
          {t("auth.forgotPassword.title", { defaultValue: "Forgot Password" })}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t("auth.forgotPassword.subtitle", {
            defaultValue:
              "Enter your email address and we'll send you a link to reset your password.",
          })}
        </Typography>

        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={3}>
            {error && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <TextField
              label={t("auth.email")}
              type="email"
              fullWidth
              required
              autoComplete="email"
              {...register("email")}
              error={!!errors.email}
              helperText={errors.email?.message}
              size="medium"
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isSubmitting || !isValid}
              fullWidth
              sx={{ borderRadius: 2 }}
            >
              {isSubmitting
                ? t("auth.forgotPassword.sending", { defaultValue: "Sending..." })
                : t("auth.forgotPassword.sendResetLink", {
                    defaultValue: "Send Reset Link",
                  })}
            </Button>

            <Button
              type="button"
              variant="text"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(AppRoutes.LOGIN)}
              sx={{ alignSelf: "center" }}
            >
              {t("auth.backToLogin", { defaultValue: "Back to Login" })}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
};

export default ForgotPasswordPage;




