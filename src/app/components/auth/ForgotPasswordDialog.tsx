// src/app/components/auth/ForgotPasswordDialog.tsx
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Alert,
  Typography,
  Box,
  Tooltip,
} from "@mui/material";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "@app/lib/apiClient";
import { useTranslation } from "react-i18next";
import { CheckCircle } from "@mui/icons-material";

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
});

type FormValues = z.infer<typeof schema>;

interface ForgotPasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

const ForgotPasswordDialog: React.FC<ForgotPasswordDialogProps> = ({
  open,
  onClose,
}) => {
  const { t } = useTranslation();

  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const hasErrors = Object.keys(errors).length > 0;

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

  const handleClose = () => {
    if (!isSubmitting) {
      setSuccess(false);
      setError(null);
      reset();
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle>
        <Typography variant="h5" fontWeight={600}>
          {t("auth.forgotPassword.title", { defaultValue: "Forgot Password" })}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {success ? (
          <Box sx={{ textAlign: "center", py: 2 }}>
            <CheckCircle
              sx={{ fontSize: 64, color: "success.main", mb: 2 }}
            />
            <Typography variant="h6" gutterBottom fontWeight={600}>
              {t("auth.forgotPassword.emailSent", {
                defaultValue: "Check Your Email",
              })}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("auth.forgotPassword.success", {
                defaultValue:
                  "If an account exists with this email, a password reset link has been sent. Please check your inbox.",
              })}
            </Typography>
          </Box>
        ) : (
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t("auth.forgotPassword.subtitle", {
                defaultValue:
                  "Enter your email address and we'll send you a link to reset your password.",
              })}
            </Typography>

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
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        {success ? (
          <Button
            variant="contained"
            onClick={handleClose}
            fullWidth
            sx={{ borderRadius: 2 }}
          >
            {t("common.close", { defaultValue: "Close" })}
          </Button>
        ) : (
          <>
            <Button
              onClick={handleClose}
              disabled={isSubmitting}
              sx={{ borderRadius: 2 }}
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
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
                  variant="contained"
                  onClick={handleSubmit(onSubmit)}
                  disabled={isSubmitting || !isValid}
                  sx={{ borderRadius: 2 }}
                >
                  {isSubmitting
                    ? t("auth.forgotPassword.sending", { defaultValue: "Sending..." })
                    : t("auth.forgotPassword.sendResetLink", {
                        defaultValue: "Send Reset Link",
                      })}
                </Button>
              </span>
            </Tooltip>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ForgotPasswordDialog;

