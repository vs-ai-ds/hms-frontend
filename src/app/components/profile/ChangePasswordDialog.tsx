// src/app/components/profile/ChangePasswordDialog.tsx
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
} from "@mui/material";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useToast } from "@app/components/common/ToastProvider";
import { changePassword } from "@app/lib/api/users";

const schema = z
  .object({
    old_password: z.string().min(1, "Current password is required"),
    new_password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one digit")
      .regex(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/, "Password must contain at least one special character"),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type FormValues = z.infer<typeof schema>;

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

const ChangePasswordDialog: React.FC<ChangePasswordDialogProps> = ({
  open,
  onClose,
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await changePassword(values.old_password, values.new_password);
      showSuccess(
        t("profile.passwordChangeSuccess", {
          defaultValue: "Password changed successfully",
        })
      );
      reset();
      onClose();
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.detail ??
        t("profile.passwordChangeError", {
          defaultValue: "Failed to change password. Please try again.",
        });
      showError(errorMessage);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t("profile.changePassword", { defaultValue: "Change Password" })}
      </DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              {t("profile.passwordRequirements", {
                defaultValue:
                  "Password must be at least 8 characters and include uppercase, lowercase, digit, and special character.",
              })}
            </Alert>

            <TextField
              label={t("profile.currentPassword", {
                defaultValue: "Current Password",
              })}
              type="password"
              fullWidth
              required
              {...register("old_password")}
              error={!!errors.old_password}
              helperText={errors.old_password?.message}
              autoComplete="current-password"
            />

            <TextField
              label={t("profile.newPassword", {
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
              label={t("profile.confirmPassword", {
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
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? t("common.changing", { defaultValue: "Changing..." })
              : t("profile.changePassword", { defaultValue: "Change Password" })}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ChangePasswordDialog;


