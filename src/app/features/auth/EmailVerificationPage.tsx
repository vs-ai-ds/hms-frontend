// src/app/features/auth/EmailVerificationPage.tsx
import React, { useEffect, useState } from "react";
import {
  Box,
  CircularProgress,
  Typography,
  Alert,
  Button,
} from "@mui/material";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@app/lib/apiClient";
import { useTranslation } from "react-i18next";
import { AppRoutes } from "@app/routes";
import { useToast } from "@app/components/common/ToastProvider";
import { CheckCircle, Error as ErrorIcon } from "@mui/icons-material";

const EmailVerificationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const token = searchParams.get("token");
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const { isLoading, isError, error, data } = useQuery({
    queryKey: ["verify-email", token],
    queryFn: async () => {
      if (!token) {
        throw new Error("No verification token provided");
      }
      const res = await apiClient.get("/auth/verify-email", {
        params: { token },
      });
      return res.data;
    },
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (!token) {
      const errorMsg = t("emailVerification.noToken", {
        defaultValue: "No verification token was provided in the link.",
      });
      setMessage(errorMsg);
      setIsSuccess(false);
      showError(errorMsg);
      // Redirect after showing message
      setTimeout(() => {
        navigate(AppRoutes.LANDING, { replace: true });
      }, 3000);
      return;
    }

    if (data) {
      const successMsg =
        data?.message ||
        t("emailVerification.successMessage", {
          defaultValue:
            "Your hospital account has been activated. You can now log in to access the system.",
        });
      setMessage(successMsg);
      setIsSuccess(true);
      showSuccess(successMsg);
      // Redirect after showing message
      setTimeout(() => {
        setRedirecting(true);
        navigate(AppRoutes.LANDING, { replace: true });
      }, 3000);
    }

    if (isError && error) {
      const errorMsg =
        (error as any)?.response?.data?.detail ||
        (error as any)?.message ||
        t("emailVerification.errorMessage", {
          defaultValue: "The verification link is invalid or has expired.",
        });
      setMessage(errorMsg);
      setIsSuccess(false);
      showError(errorMsg);
      // Redirect after showing message
      setTimeout(() => {
        setRedirecting(true);
        navigate(AppRoutes.LANDING, { replace: true });
      }, 3000);
    }
  }, [token, data, isError, error, navigate, t, showSuccess, showError]);

  // Show loading state while verifying
  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          py: 4,
          gap: 3,
        }}
      >
        <CircularProgress size={64} />
        <Typography variant="h6" color="text.secondary">
          {t("emailVerification.verifying", {
            defaultValue: "Verifying your email...",
          })}
        </Typography>
      </Box>
    );
  }

  // Show success/error message
  if (message) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          py: 4,
          gap: 3,
          p: 3,
        }}
      >
        {isSuccess ? (
          <CheckCircle sx={{ fontSize: 80, color: "success.main" }} />
        ) : (
          <ErrorIcon sx={{ fontSize: 80, color: "error.main" }} />
        )}
        <Alert
          severity={isSuccess ? "success" : "error"}
          sx={{
            maxWidth: 600,
            width: "100%",
            borderRadius: 2,
            fontSize: "1rem",
          }}
        >
          {message}
        </Alert>
        {redirecting ? (
          <Typography variant="body2" color="text.secondary">
            {t("emailVerification.redirecting", {
              defaultValue: "Redirecting to login...",
            })}
          </Typography>
        ) : (
          <Button
            variant="contained"
            onClick={() => navigate(AppRoutes.LANDING, { replace: true })}
            sx={{ mt: 2 }}
          >
            {t("emailVerification.goToLogin", {
              defaultValue: "Go to Login",
            })}
          </Button>
        )}
      </Box>
    );
  }

  return null;
};

export default EmailVerificationPage;