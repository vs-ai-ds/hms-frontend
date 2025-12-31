// src/app/features/auth/ResetPasswordPage.tsx
import React, { useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Stack,
  Typography,
  Paper,
  Tooltip,
  Link,
} from "@mui/material";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "@app/lib/apiClient";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppRoutes } from "@app/routes";
import { useTranslation } from "react-i18next";
import { CheckCircle, Error as ErrorIcon } from "@mui/icons-material";
import { useToast } from "@app/components/common/ToastProvider";
import { useAuthStore } from "@app/store/authStore";
import { useQuery } from "@tanstack/react-query";
import ForgotPasswordDialog from "@app/components/auth/ForgotPasswordDialog";

const schema = z
  .object({
    new_password: z
      .string()
      .min(8, "Password must be at least 8 characters long"),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type FormValues = z.infer<typeof schema>;

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const currentUser = useAuthStore((s) => s.user);
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [forgotPasswordOpen, setForgotPasswordOpen] = React.useState(false);

  const [success, setSuccess] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Check if user is already logged in - redirect to dashboard
  useEffect(() => {
    if (currentUser) {
      navigate(AppRoutes.DASHBOARD, { replace: true });
    }
  }, [currentUser, navigate]);

  // Validate token on load
  const {
    data: tokenValidation,
    isLoading: isValidatingToken,
    isError: isTokenError,
    error: tokenError,
  } = useQuery({
    queryKey: ["validate-reset-token", token],
    queryFn: async () => {
      if (!token) {
        throw new Error("No token provided");
      }
      const res = await apiClient.get("/auth/validate-reset-token", {
        params: { token },
      });
      return res.data;
    },
    enabled: !!token && !currentUser,
    retry: false,
  });

  // Handle token validation error
  React.useEffect(() => {
    if (isTokenError && tokenError) {
      const errorMessage =
        (tokenError as any)?.response?.data?.detail ||
        t("auth.resetPassword.invalidLink", {
          defaultValue: "Invalid or expired reset link.",
        });
      showError(errorMessage);
    }
  }, [isTokenError, tokenError, showError, t]);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const hasErrors = Object.keys(errors).length > 0;

  const onSubmit = async (values: FormValues) => {
    if (!token) {
      showError(
        t("auth.resetPassword.noToken", {
          defaultValue: "No reset token provided.",
        })
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post("/auth/reset-password", {
        token,
        new_password: values.new_password,
      });
      setSuccess(true);
      showSuccess(
        t("auth.resetPassword.successMessage", {
          defaultValue:
            "Your password has been reset successfully. You can now log in with your new password.",
        })
      );
      // Redirect to login after a brief delay
      setTimeout(() => {
        navigate(AppRoutes.LOGIN, { replace: true });
      }, 2000);
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.detail ??
        t("auth.resetPassword.error", {
          defaultValue: "Failed to reset password. The link may have expired.",
        });
      showError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading while validating token
  if (isValidatingToken) {
    return (
      <Box
        sx={{
          textAlign: "center",
          py: 4,
        }}
      >
        <Typography variant="h6" color="text.secondary">
          {t("auth.resetPassword.validating", {
            defaultValue: "Validating reset link...",
          })}
        </Typography>
      </Box>
    );
  }

  // No token or invalid token - show error and option to request new link
  if (!token || isTokenError) {
    return (
      <Box sx={{ maxWidth: 500, mx: "auto", py: 2 }}>
        <Paper
          elevation={2}
          sx={{ p: 4, borderRadius: 3, textAlign: "center" }}
        >
          <ErrorIcon sx={{ fontSize: 64, color: "error.main", mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            {t("auth.resetPassword.invalidLink", {
              defaultValue: "Invalid Reset Link",
            })}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t("auth.resetPassword.invalidLinkMessage", {
              defaultValue:
                "This password reset link is invalid or has expired. Please request a new one.",
            })}
          </Typography>
          <Stack spacing={2} direction="row" justifyContent="center">
            <Button
              variant="outlined"
              onClick={() => setForgotPasswordOpen(true)}
              sx={{ borderRadius: 2 }}
            >
              {t("auth.resetPassword.requestNewLink", {
                defaultValue: "Request New Reset Link",
              })}
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate(AppRoutes.LOGIN)}
              sx={{ borderRadius: 2 }}
            >
              {t("auth.backToLogin", { defaultValue: "Go to Login" })}
            </Button>
          </Stack>
        </Paper>
        <ForgotPasswordDialog
          open={forgotPasswordOpen}
          onClose={() => setForgotPasswordOpen(false)}
        />
      </Box>
    );
  }

  if (success) {
    return (
      <Box sx={{ maxWidth: 500, mx: "auto", py: 2 }}>
        <Paper
          elevation={2}
          sx={{ p: 4, borderRadius: 3, textAlign: "center" }}
        >
          <CheckCircle sx={{ fontSize: 64, color: "success.main", mb: 2 }} />
          <Typography variant="h5" gutterBottom fontWeight={600}>
            {t("auth.resetPassword.success", {
              defaultValue: "Password Reset Successfully!",
            })}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t("auth.resetPassword.successMessage", {
              defaultValue:
                "Your password has been reset successfully. Redirecting to login...",
            })}
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate(AppRoutes.LOGIN)}
            sx={{ borderRadius: 2 }}
          >
            {t("auth.backToLogin", { defaultValue: "Go to Login" })}
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 500, mx: "auto", py: 2 }}>
      <Paper elevation={2} sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="h5" fontWeight={600} sx={{ mb: 1 }}>
          {t("auth.resetPassword.title", { defaultValue: "Reset Password" })}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t("auth.resetPassword.subtitle", {
            defaultValue: "Enter your new password below.",
          })}
        </Typography>

        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={3}>
            <TextField
              label={t("auth.newPassword", { defaultValue: "New Password" })}
              type="password"
              fullWidth
              required
              autoComplete="new-password"
              {...register("new_password")}
              error={!!errors.new_password}
              helperText={errors.new_password?.message}
              size="medium"
            />

            <TextField
              label={t("auth.confirmPassword", {
                defaultValue: "Confirm Password",
              })}
              type="password"
              fullWidth
              required
              autoComplete="new-password"
              {...register("confirm_password")}
              error={!!errors.confirm_password}
              helperText={errors.confirm_password?.message}
              size="medium"
            />

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
                  size="large"
                  disabled={isSubmitting || !isValid || !tokenValidation?.valid}
                  fullWidth
                  sx={{ borderRadius: 2 }}
                >
                  {isSubmitting
                    ? t("auth.resetPassword.resetting", {
                        defaultValue: "Resetting...",
                      })
                    : t("auth.resetPassword.reset", {
                        defaultValue: "Reset Password",
                      })}
                </Button>
              </span>
            </Tooltip>

            <Box sx={{ textAlign: "center", mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {t("auth.resetPassword.rememberPassword", {
                  defaultValue: "Remember your password?",
                })}{" "}
                <Link
                  component="button"
                  type="button"
                  onClick={() => navigate(AppRoutes.LOGIN)}
                  sx={{
                    textDecoration: "none",
                    color: "primary.main",
                    fontWeight: 500,
                    "&:hover": { textDecoration: "underline" },
                    cursor: "pointer",
                  }}
                >
                  {t("auth.login", { defaultValue: "Login" })}
                </Link>
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
};

export default ResetPasswordPage;