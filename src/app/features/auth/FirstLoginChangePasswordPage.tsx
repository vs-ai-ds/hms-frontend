// src/app/features/auth/FirstLoginChangePasswordPage.tsx
import React from "react";
import {
  Box,
  Button,
  TextField,
  Stack,
  Alert,
  Typography,
} from "@mui/material";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { AppRoutes } from "@app/routes";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@app/store/authStore";
import { useToast } from "@app/components/common/ToastProvider";
import { changePassword } from "@app/lib/api/users";

type FormValues = {
  new_password: string;
  confirm_password: string;
};

const FirstLoginChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuthStore();

  // Build schema with translated messages
  const schema = React.useMemo(
    () =>
      z
        .object({
          new_password: z
            .string()
            .min(
              8,
              t("auth.firstLogin.validation.minLength", {
                defaultValue: "Password must be at least 8 characters long",
              })
            )
            .regex(
              /[A-Z]/,
              t("auth.firstLogin.validation.uppercase", {
                defaultValue:
                  "Password must contain at least one uppercase letter",
              })
            )
            .regex(
              /[a-z]/,
              t("auth.firstLogin.validation.lowercase", {
                defaultValue:
                  "Password must contain at least one lowercase letter",
              })
            )
            .regex(
              /[0-9]/,
              t("auth.firstLogin.validation.digit", {
                defaultValue: "Password must contain at least one digit",
              })
            )
            .regex(
              /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/,
              t("auth.firstLogin.validation.special", {
                defaultValue:
                  "Password must contain at least one special character",
              })
            ),
          confirm_password: z.string(),
        })
        .refine((data) => data.new_password === data.confirm_password, {
          message: t("auth.firstLogin.validation.mismatch", {
            defaultValue: "Passwords do not match",
          }),
          path: ["confirm_password"],
        }),
    [t]
  );

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
  });

  // Redirect if user doesn't need to change password
  React.useEffect(() => {
    if (user && !user.must_change_password) {
      navigate(AppRoutes.DASHBOARD, { replace: true });
    }
  }, [user, navigate]);

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!user) {
      navigate(AppRoutes.LOGIN, { replace: true });
    }
  }, [user, navigate]);

  const onSubmit = async (values: FormValues) => {
    try {
      // Call change-password endpoint without old_password (first-login mode)
      await changePassword(null, values.new_password);

      showSuccess(
        t("auth.firstLogin.passwordChanged", {
          defaultValue: "Password changed successfully. Please log in again.",
        })
      );

      // Clear session and redirect to login
      logout();
      setTimeout(() => {
        navigate(AppRoutes.LOGIN, { replace: true });
      }, 1500);
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.detail ??
        t("auth.firstLogin.error", {
          defaultValue: "Failed to change password. Please try again.",
        });
      showError(errorMessage);
    }
  };

  if (!user || !user.must_change_password) {
    return null; // Will redirect via useEffect
  }

  return (
    <Box>
      <Typography
        variant="h5"
        fontWeight={600}
        sx={{ mb: 1.5 }}
      >
        {t("auth.firstLogin.title", {
          defaultValue: "Change Your Password",
        })}
      </Typography>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 2 }}
      >
        {t("auth.firstLogin.subtitle", {
          defaultValue:
            "You must change your temporary password before continuing.",
        })}
      </Typography>

      <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
        {t("auth.firstLogin.requirements", {
          defaultValue:
            "Password must be at least 8 characters and include uppercase, lowercase, digit, and special character.",
        })}
      </Alert>

      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2}>
          <TextField
            label={t("auth.firstLogin.newPassword", {
              defaultValue: "New Password",
            })}
            type="password"
            fullWidth
            required
            {...register("new_password")}
            error={!!errors.new_password}
            helperText={errors.new_password?.message}
            autoComplete="new-password"
          />

          <TextField
            label={t("auth.firstLogin.confirmPassword", {
              defaultValue: "Confirm New Password",
            })}
            type="password"
            fullWidth
            required
            {...register("confirm_password")}
            error={!!errors.confirm_password}
            helperText={errors.confirm_password?.message}
            autoComplete="new-password"
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={isSubmitting}
            sx={{ mt: 1 }}
          >
            {isSubmitting
              ? t("common.changing", { defaultValue: "Changing..." })
              : t("auth.firstLogin.changePassword", {
                  defaultValue: "Change Password",
                })}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};

export default FirstLoginChangePasswordPage;
