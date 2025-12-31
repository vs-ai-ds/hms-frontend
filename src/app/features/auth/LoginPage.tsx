// src/app/features/auth/LoginPage.tsx
import React from "react";
import {
  Box,
  Button,
  TextField,
  Stack,
  Alert,
  Link as MuiLink,
  Tooltip,
  Typography,
  Chip,
  Divider,
  FormControl,
  Select,
  MenuItem,
  SelectChangeEvent,
} from "@mui/material";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiClient } from "@app/lib/apiClient";
import { setAccessToken } from "@app/lib/auth";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { AppRoutes } from "@app/routes";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@app/store/authStore";
import ForgotPasswordDialog from "@app/components/auth/ForgotPasswordDialog";
import {
  loginSchema,
  type LoginFormValues,
} from "@app/lib/validation/authValidation";
import { DEMO_ACCOUNTS } from "@app/lib/constants/demoCredentials";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();

  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [forgotPasswordOpen, setForgotPasswordOpen] = React.useState(false);

  // Demo mode
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const [selectedTenant, setSelectedTenant] = React.useState<"A" | "B">("A");
  const [selectedRole, setSelectedRole] = React.useState<string>("");

  // Demo account credentials - imported from shared constants
  const demoAccounts = DEMO_ACCOUNTS;

  // Check for registration success message from navigation state or URL params
  React.useEffect(() => {
    // Check navigation state first (from TenantRegisterPage)
    const state = location.state as { message?: string; messageType?: string } | null;
    if (state?.message && state?.messageType === "success") {
      setSuccessMessage(state.message);
      // Clear state by replacing location
      window.history.replaceState({}, "");
    }
    
    // Also check URL params (for backward compatibility)
    const registered = searchParams.get("registered");
    const message = searchParams.get("message");
    const email = searchParams.get("email");
    
    if (registered === "true" && message) {
      setSuccessMessage(decodeURIComponent(message));
      // Clear URL params after reading
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("registered");
      newParams.delete("message");
      newParams.delete("email");
      setSearchParams(newParams, { replace: true });
      
      // If email verification is needed, add that info
      if (email) {
        const verificationMsg = t("auth.emailVerificationRequired", {
          defaultValue: "Please check your email to verify your account before logging in.",
        });
        setSuccessMessage((prev) => prev ? `${prev}\n\n${verificationMsg}` : verificationMsg);
      }
    }
  }, [location.state, searchParams, setSearchParams, t]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting, errors, isValid },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
  });

  const emailValue = watch("email");
  const passwordValue = watch("password");

  // Handle demo account selection
  const handleDemoAccountSelect = (role: string) => {
    setSelectedRole(role);
    const account = demoAccounts[selectedTenant][role as keyof typeof demoAccounts.A];
    if (account) {
      setValue("email", account.email, { shouldValidate: true });
      setValue("password", account.password, { shouldValidate: true });
    }
  };

  const hasErrors = Object.keys(errors).length > 0;

  const onSubmit = async (values: LoginFormValues) => {
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("username", values.email.trim());
      params.append("password", values.password.trim());
      params.append("grant_type", "password");

      const res = await apiClient.post<{
        access_token: string;
        must_change_password?: boolean;
      }>("/auth/login", params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      setAccessToken(res.data.access_token);

      // Fetch user data immediately after setting token
      try {
        const userRes = await apiClient.get("/auth/me");
        const { setUser, setToken } = useAuthStore.getState();
        setToken(res.data.access_token);
        const userData = userRes.data;
        // Include must_change_password from login response or user data
        if (res.data.must_change_password !== undefined) {
          userData.must_change_password = res.data.must_change_password;
        }
        setUser(userData);

        // Check if user must change password - redirect to first-login page
        if (userData.must_change_password) {
          navigate(AppRoutes.FIRST_LOGIN_CHANGE_PASSWORD, { replace: true });
          return;
        }
      } catch (userError) {
        // If /auth/me fails, still try to navigate - useAuthInit will handle it
        console.warn("Failed to fetch user data immediately:", userError);
      }

      navigate(AppRoutes.DASHBOARD, { replace: true });
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.detail ||
        err?.message ||
        t("auth.loginError", "Invalid credentials or login failed.");
      setError(errorMessage);
    }
  };

  return (
    <Box>
      {/* Sub-heading under logo/header */}
      <Typography
        variant="h5"
        fontWeight={600}
        sx={{ mb: 2 }}
      >
        {t("auth.loginHeading", { defaultValue: "Login" })}
      </Typography>

      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={3}>
          {successMessage && (
            <Alert severity="success" sx={{ borderRadius: 2, whiteSpace: "pre-line" }}>
              {successMessage}
            </Alert>
          )}
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
            InputLabelProps={{
              shrink: !!emailValue,
            }}
          />

          <TextField
            label={t("auth.password")}
            type="password"
            fullWidth
            required
            autoComplete="current-password"
            {...register("password")}
            error={!!errors.password}
            helperText={errors.password?.message}
            size="medium"
            InputLabelProps={{
              shrink: !!passwordValue,
            }}
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
                disabled={isSubmitting || !isValid}
                fullWidth
                sx={{ py: 1.5 }}
              >
                {isSubmitting
                  ? t("auth.loggingIn", { defaultValue: "Signing In..." })
                  : t("auth.login")}
              </Button>
            </span>
          </Tooltip>

          {/* Links row: left = register, right = forgot password */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mt: -1, // slightly pull up to keep tight with button
            }}
          >
            <MuiLink
              component="button"
              type="button"
              onClick={() => navigate(AppRoutes.TENANT_REGISTER)}
              sx={{
                textDecoration: "none",
                color: "primary.main",
                fontSize: "0.9rem",
                fontWeight: 500,
                "&:hover": {
                  textDecoration: "underline",
                },
                cursor: "pointer",
              }}
            >
              {t("auth.registerHospital", {
                defaultValue: "Register new hospital",
              })}
            </MuiLink>

            <MuiLink
              component="button"
              type="button"
              onClick={() => setForgotPasswordOpen(true)}
              sx={{
                textDecoration: "none",
                color: "primary.main",
                fontSize: "0.9rem",
                fontWeight: 500,
                "&:hover": {
                  textDecoration: "underline",
                },
                cursor: "pointer",
              }}
            >
              {t("auth.forgotPassword", { defaultValue: "Forgot password?" })}
            </MuiLink>
          </Box>
        </Stack>
      </Box>

      {/* Demo Account Selector - Only show when VITE_DEMO_MODE=true */}
      {isDemoMode && (
        <>
          <Divider sx={{ my: 3 }}>
            <Typography variant="body2" color="text.secondary">
              {t("auth.demo.tryDemoAccount", { defaultValue: "Try a demo account" })}
            </Typography>
          </Divider>

          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <Select
                value={selectedTenant}
                onChange={(e: SelectChangeEvent<"A" | "B">) => {
                  setSelectedTenant(e.target.value as "A" | "B");
                  setSelectedRole("");
                  setValue("email", "");
                  setValue("password", "");
                }}
                displayEmpty
              >
                <MenuItem value="A">
                  {t("auth.demo.tenantA", { defaultValue: "Tenant A" })}
                </MenuItem>
                <MenuItem value="B">
                  {t("auth.demo.tenantB", { defaultValue: "Tenant B" })}
                </MenuItem>
              </Select>
            </FormControl>

            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 1,
                justifyContent: "center",
              }}
            >
              {(["admin", "doctor", "nurse", "pharmacist", "receptionist"] as const).map((role) => (
                <Chip
                  key={role}
                  label={t(`auth.demo.role.${role}`, {
                    defaultValue: role.charAt(0).toUpperCase() + role.slice(1),
                  })}
                  onClick={() => handleDemoAccountSelect(role)}
                  color={selectedRole === role ? "primary" : "default"}
                  variant={selectedRole === role ? "filled" : "outlined"}
                  sx={{
                    cursor: "pointer",
                    minWidth: 100,
                  }}
                />
              ))}
            </Box>

            {selectedRole && (
              <Alert severity="info" sx={{ mt: 2, fontSize: "0.875rem" }}>
                {t("auth.demo.accountSelected", {
                  defaultValue: "Account selected. Click Login to continue.",
                })}
              </Alert>
            )}
          </Box>
        </>
      )}

      {/* Forgot Password Dialog */}
      <ForgotPasswordDialog
        open={forgotPasswordOpen}
        onClose={() => setForgotPasswordOpen(false)}
      />
    </Box>
  );
};

export default LoginPage;