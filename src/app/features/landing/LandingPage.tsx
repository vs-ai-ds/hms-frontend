// src/app/features/landing/LandingPage.tsx
import React from "react";
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Stack,
  useTheme,
  Fade,
  Grow,
  Avatar,
  Divider,
  Link,
  Paper,
  TextField,
  Alert,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  Chip,
  Tooltip,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  Hotel as IPDIcon,
  LocalPharmacy as PharmacyIcon,
  Science as LabIcon,
  Receipt as BillingIcon,
  Description as DocumentsIcon,
  Person as PersonIcon,
  Analytics as AnalyticsIcon,
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
  Shield as ShieldIcon,
  Speed as SpeedIcon,
  VerifiedUser as AccessControlIcon,
  TrendingUp as AnalyticsRealTimeIcon,
  CloudQueue as CloudIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppRoutes } from "@app/routes";
import LanguageSwitcher from "@app/components/common/LanguageSwitcher";
import ForgotPasswordDialog from "@app/components/auth/ForgotPasswordDialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "@app/lib/apiClient";
import { setAccessToken } from "@app/lib/auth";
import { useAuthStore } from "@app/store/authStore";
import { loginSchema, type LoginFormValues } from "@app/lib/validation/authValidation";

const hospitalNameRegex = /^[A-Za-z0-9\- ]+$/;
const phoneRegex = /^[0-9+\-\s]{5,15}$/;

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(5, "Hospital name must be at least 5 characters")
    .regex(
      hospitalNameRegex,
      "Hospital name can contain letters, numbers, spaces and dashes only"
    ),
  address: z.string().trim().min(1, "Address is required"),
  contact_email: z
    .string()
    .trim()
    .min(1, "Contact email is required")
    .email("Enter a valid email address"),
  contact_phone: z
    .string()
    .trim()
    .refine((val) => phoneRegex.test(val), {
      message: "Phone must be 10–15 characters and contain only digits, spaces, + or -",
    }),
  license_number: z.string().trim().min(3, "License number is required"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [heroVisible, setHeroVisible] = React.useState(false);
  const [tabValue, setTabValue] = React.useState(0);
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = React.useState<string | null>(null);
  const [registerError, setRegisterError] = React.useState<string | null>(null);
  const [forgotPasswordOpen, setForgotPasswordOpen] = React.useState(false);

  React.useEffect(() => {
    setHeroVisible(true);
  }, []);

  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    formState: { isSubmitting: isLoggingIn, isValid: isLoginValid, errors: loginErrors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
  });

  const {
    register: registerRegister,
    handleSubmit: handleRegisterSubmit,
    formState: { isSubmitting: isRegistering, isValid: isRegisterValid, errors: registerErrors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
  });

  const onLoginSubmit = async (values: LoginFormValues) => {
    setLoginError(null);
    try {
      const params = new URLSearchParams();
      params.append("username", values.email.trim());
      params.append("password", values.password.trim());
      params.append("grant_type", "password");

      const res = await apiClient.post<{ access_token: string }>(
        "/auth/login",
        params,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      setAccessToken(res.data.access_token);
      
      // Fetch user data immediately after setting token
      try {
        const userRes = await apiClient.get("/auth/me");
        const { setUser, setToken } = useAuthStore.getState();
        setToken(res.data.access_token);
        setUser(userRes.data);
      } catch (userError) {
        // If /auth/me fails, still try to navigate - useAuthInit will handle it
        console.warn("Failed to fetch user data immediately:", userError);
      }
      
      navigate(AppRoutes.DASHBOARD, { replace: true });
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || 
                          err?.message || 
                          t("auth.loginError", "Invalid credentials or login failed.");
      setLoginError(errorMessage);
    }
  };

  const onRegisterSubmit = async (values: RegisterFormValues) => {
    setRegisterError(null);
    setRegisterSuccess(null);
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

      const msg = t("tenant.registerSuccessLogin", {
        defaultValue:
          "Hospital registered successfully! Please check your email to verify your account, then login with:\nAdmin Email: {{email}}\nTemporary Password: {{password}}",
        email: data.admin_email ?? "-",
        password: data.admin_temp_password ?? "-",
      });

      // Switch to login tab and show success message
      setRegisterSuccess(msg);
      setTabValue(0); // Switch to login tab
    } catch (err: any) {
      setRegisterError(
        err?.response?.data?.detail ??
          t("tenant.registerError", "Failed to register hospital. Please try again.")
      );
    }
  };

  const clinicalWorkflows = [
    {
      icon: <PeopleIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: t("landing.features.patients.title", { defaultValue: "Patient Management" }),
      description: t("landing.features.patients.short", {
        defaultValue: "Complete patient records with medical history tracking.",
      }),
    },
    {
      icon: <AssignmentIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: t("landing.features.opd.title", { defaultValue: "OPD Appointments" }),
      description: t("landing.features.opd.short", {
        defaultValue: "Streamlined scheduling for outpatient department visits.",
      }),
    },
    {
      icon: <IPDIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: t("landing.features.ipd.title", { defaultValue: "IPD Management" }),
      description: t("landing.features.ipd.short", {
        defaultValue: "Bed allocation, admission, and discharge workflows.",
      }),
    },
    {
      icon: <PharmacyIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: t("landing.features.prescriptions.title", { defaultValue: "Prescriptions" }),
      description: t("landing.features.prescriptions.short", {
        defaultValue: "Digital prescriptions with medicine tracking.",
      }),
    },
    {
      icon: <LabIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: t("landing.features.lab.title", { defaultValue: "Lab Management" }),
      description: t("landing.features.lab.short", {
        defaultValue: "Test ordering and result management system.",
      }),
    },
    {
      icon: <PharmacyIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: t("landing.features.pharmacy.title", { defaultValue: "Pharmacy" }),
      description: t("landing.features.pharmacy.short", {
        defaultValue: "Inventory management with stock tracking.",
      }),
    },
  ];

  const hospitalOperations = [
    {
      icon: <BillingIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: t("landing.features.billing.title", { defaultValue: "Billing & Invoicing" }),
      description: t("landing.features.billing.short", {
        defaultValue: "Automated billing with insurance integration.",
      }),
    },
    {
      icon: <DocumentsIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: t("landing.features.documents.title", { defaultValue: "Documents & Imaging" }),
      description: t("landing.features.documents.short", {
        defaultValue: "Secure document storage and medical imaging.",
      }),
    },
    {
      icon: <PersonIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: t("landing.features.staff.title", { defaultValue: "Staff Management" }),
      description: t("landing.features.staff.short", {
        defaultValue: "Role-based access for doctors, nurses, and admin.",
      }),
    },
  ];

  const platformFeatures = [
    {
      icon: <AnalyticsIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: t("landing.features.analytics.title", { defaultValue: "Analytics Dashboard" }),
      description: t("landing.features.analytics.short", {
        defaultValue: "Real-time insights and comprehensive reports.",
      }),
    },
    {
      icon: <NotificationsIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: t("landing.features.notifications.title", { defaultValue: "Notifications" }),
      description: t("landing.features.notifications.short", {
        defaultValue: "Multi-channel alerts via email, SMS, and WhatsApp.",
      }),
    },
    {
      icon: <SecurityIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: t("landing.features.security.title", { defaultValue: "Secure Multi-Tenant Architecture" }),
      description: t("landing.features.security.short", {
        defaultValue: "Complete data isolation and encryption.",
      }),
    },
  ];

  const whyChoose = [
    {
      icon: <ShieldIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: t("landing.whyChoose.security.title", { defaultValue: "Enterprise-Grade Security" }),
      description: t("landing.whyChoose.security.description", {
        defaultValue: "Protect sensitive patient data with encrypted storage and strict access control.",
      }),
    },
    {
      icon: <SpeedIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: t("landing.whyChoose.workflows.title", { defaultValue: "Streamlined OPD/IPD Workflows" }),
      description: t("landing.whyChoose.workflows.description", {
        defaultValue: "Fast, intuitive tools for doctors, nurses, and hospital staff.",
      }),
    },
    {
      icon: <LabIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: t("landing.whyChoose.integration.title", { defaultValue: "Lab & Pharmacy Integration" }),
      description: t("landing.whyChoose.integration.description", {
        defaultValue: "Reduce errors and improve patient safety with connected systems.",
      }),
    },
    {
      icon: <AccessControlIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: t("landing.whyChoose.rbac.title", { defaultValue: "Role-Based Access Control" }),
      description: t("landing.whyChoose.rbac.description", {
        defaultValue: "Permissions tailored for doctors, nurses, admin, lab, and pharmacy teams.",
      }),
    },
    {
      icon: <AnalyticsRealTimeIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: t("landing.whyChoose.analytics.title", { defaultValue: "Real-Time Analytics" }),
      description: t("landing.whyChoose.analytics.description", {
        defaultValue: "Track patient load, appointments, and clinical activity instantly.",
      }),
    },
    {
      icon: <CloudIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: t("landing.whyChoose.platform.title", { defaultValue: "Reliable Multi-Tenant Platform" }),
      description: t("landing.whyChoose.platform.description", {
        defaultValue: "Scales from small clinics to mid-sized hospitals effortlessly.",
      }),
    },
  ];

  const testimonials = [
    {
      quote: t("landing.testimonials.doctor1.quote", {
        defaultValue: "Our OPD workflow improved dramatically — doctors get complete patient history instantly.",
      }),
      name: t("landing.testimonials.doctor1.name", { defaultValue: "Dr. Priya Sharma" }),
      hospital: t("landing.testimonials.doctor1.hospital", { defaultValue: "City General Hospital" }),
    },
    {
      quote: t("landing.testimonials.admin1.quote", {
        defaultValue: "The pharmacy and lab modules reduced manual errors and improved turnaround time.",
      }),
      name: t("landing.testimonials.admin1.name", { defaultValue: "Rajesh Kumar" }),
      hospital: t("landing.testimonials.admin1.hospital", { defaultValue: "Community Health Center" }),
    },
    {
      quote: t("landing.testimonials.staff1.quote", {
        defaultValue: "IPD admissions and discharge workflows are so much smoother now.",
      }),
      name: t("landing.testimonials.staff1.name", { defaultValue: "Anita Patel" }),
      hospital: t("landing.testimonials.staff1.hospital", { defaultValue: "Rural Health Clinic" }),
    },
  ];

  const logoSrc =
    i18n.language && i18n.language.startsWith("hi")
      ? "/logo-hi.svg"
      : "/logo.svg";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f5f7fb 0%, #e8f0fe 30%, #ffffff 100%)",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          py: { xs: 1.5, sm: 2.5 },
          px: { xs: 1, sm: 0 },
          borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(20px)",
          position: "sticky",
          top: 0,
          zIndex: 1000,
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
        }}
      >
        <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2 } }}>
          <Box 
            display="flex" 
            justifyContent="space-between" 
            alignItems="center"
            gap={{ xs: 1, sm: 2 }}
            sx={{
              flexWrap: { xs: "nowrap", sm: "nowrap" },
            }}
          >
            <Box 
              display="flex" 
              alignItems="center" 
              sx={{ 
                flexShrink: 0,
                minWidth: 0,
              }}
            >
              <Box
                component="img"
                src={logoSrc}
                alt="HMS Logo"
                sx={{ 
                  height: { xs: 36, sm: 56 }, 
                  width: "auto",
                  maxWidth: { xs: "150px", sm: "none" }
                }}
              />
            </Box>
            <Box 
              display="flex" 
              gap={{ xs: 0.5, sm: 2 }} 
              alignItems="center"
              sx={{
                flexShrink: 0,
                minWidth: 0,
              }}
            >
              <Button
                variant="outlined"
                onClick={() => {
                  navigate(AppRoutes.LOGIN);
                }}
                sx={{ 
                  borderRadius: 2,
                  fontSize: { xs: "0.7rem", sm: "0.875rem" },
                  px: { xs: 1, sm: 2 },
                  py: { xs: 0.5, sm: 1 },
                  minWidth: { xs: "60px", sm: "64px" },
                  whiteSpace: "nowrap",
                }}
              >
                {t("landing.login", { defaultValue: "Login" })}
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  navigate(AppRoutes.TENANT_REGISTER);
                }}
                sx={{ 
                  borderRadius: 2,
                  fontSize: { xs: "0.7rem", sm: "0.875rem" },
                  px: { xs: 1, sm: 2 },
                  py: { xs: 0.5, sm: 1 },
                  minWidth: { xs: "60px", sm: "64px" },
                  whiteSpace: "nowrap",
                }}
              >
                {t("landing.getStarted", { defaultValue: "Get Started" })}
              </Button>
              <Box sx={{ flexShrink: 0, ml: { xs: 0.5, sm: 0 } }}>
                <LanguageSwitcher />
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Hero Section */}
      <Box
        sx={{
          minHeight: "85vh",
          display: "flex",
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #f5f7fb 0%, #e8f0fe 30%, #ffffff 100%)",
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "radial-gradient(circle at 20% 50%, rgba(29, 122, 243, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(0, 168, 107, 0.1) 0%, transparent 50%)",
            pointerEvents: "none",
          },
        }}
      >
        <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1, py: 6, width: "100%" }}>
          <Grid container spacing={6} alignItems="center">
            {/* Left Side - Headline */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Fade in={heroVisible} timeout={800}>
                <Box>
                  <Typography
                    variant="h1"
                    component="div"
                    sx={{
                      mb: 3,
                      fontSize: { xs: "2rem", md: "2.75rem", lg: "3rem" },
                      fontWeight: 700,
                      lineHeight: 1.2,
                      color: "text.primary",
                    }}
                  >
                    {t("landing.hero.title", {
                      defaultValue: "Modern Hospital Management",
                    })}
                    <br />
                    {t("landing.hero.title2", {
                      defaultValue: "Built for Real Healthcare Workflows",
                    })}
                  </Typography>
                  <Typography
                    variant="h6"
                    color="text.secondary"
                    component="div"
                    sx={{
                      mb: 4,
                      lineHeight: 1.6,
                      fontSize: { xs: "0.95rem", md: "1rem" },
                    }}
                  >
                    {t("landing.hero.subtitle", {
                      defaultValue: "A secure, multi-tenant HMS for PHCs, CHCs, clinics, and hospitals.",
                    })}
                    <br />
                    {t("landing.hero.subtitle2", {
                      defaultValue: "Fast. Reliable. Designed for doctors, staff, and administrators.",
                    })}
                  </Typography>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    sx={{ mb: 4 }}
                  >
                    <Button
                      variant="contained"
                      size="large"
                      onClick={() => {
                        navigate(AppRoutes.TENANT_REGISTER);
                      }}
                      sx={{
                        px: 5,
                        py: 1.75,
                        fontSize: "1.1rem",
                        fontWeight: 600,
                        borderRadius: 3,
                      "&:hover": {
                        backgroundColor: "primary.dark",
                      },
                      }}
                    >
                      {t("landing.hero.register", { defaultValue: "Register Hospital" })}
                    </Button>
                    <Button
                      variant="outlined"
                      size="large"
                      onClick={() => {
                        navigate(AppRoutes.LOGIN);
                      }}
                      sx={{
                        px: 5,
                        py: 1.75,
                        fontSize: "1.1rem",
                        fontWeight: 600,
                        borderRadius: 3,
                        borderWidth: 2,
                        "&:hover": {
                          borderWidth: 2,
                        },
                      }}
                    >
                      {t("landing.hero.login", { defaultValue: "Login" })}
                    </Button>
                  </Stack>
                </Box>
              </Fade>
            </Grid>

            {/* Right Side - Auth Form */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Grow in={heroVisible} timeout={1200}>
                <Paper
                  elevation={1}
                  sx={{
                    p: 4,
                    borderRadius: 3,
                    backgroundColor: "background.paper",
                    border: "1px solid rgba(0, 0, 0, 0.08)",
                  }}
                >
                  <Tabs
                    value={tabValue}
                    onChange={(_, newValue) => {
                      setTabValue(newValue);
                      setLoginError(null);
                      setRegisterError(null);
                      // Don't clear registerSuccess when switching to login tab (tab 0)
                      // Only clear when switching away from login tab
                      if (newValue !== 0) {
                        setRegisterSuccess(null);
                      }
                    }}
                    sx={{
                      mb: 3,
                      "& .MuiTab-root": {
                        textTransform: "none",
                        fontWeight: 600,
                        fontSize: "1rem",
                      },
                    }}
                  >
                    <Tab label={t("landing.hero.login", { defaultValue: "Login" })} />
                    <Tab label={t("landing.hero.register", { defaultValue: "Register Hospital" })} />
                  </Tabs>

                  {/* Login Form */}
                  {tabValue === 0 && (
                    <Box component="form" onSubmit={handleLoginSubmit(onLoginSubmit)} noValidate>
                      <Stack spacing={2.5}>
                        {registerSuccess && (
                          <Alert severity="success" sx={{ borderRadius: 2, whiteSpace: "pre-line" }}>
                            {registerSuccess}
                          </Alert>
                        )}
                        {loginError && (
                          <Alert severity="error" sx={{ borderRadius: 2 }}>
                            {loginError}
                          </Alert>
                        )}
                        <TextField
                          label={t("auth.email")}
                          type="email"
                          fullWidth
                          required
                          autoComplete="email"
                          {...registerLogin("email")}
                          error={!!loginErrors.email}
                          helperText={loginErrors.email?.message}
                          size="medium"
                        />
                        <TextField
                          label={t("auth.password")}
                          type="password"
                          fullWidth
                          required
                          autoComplete="current-password"
                          {...registerLogin("password")}
                          error={!!loginErrors.password}
                          helperText={loginErrors.password?.message}
                          size="medium"
                        />
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "flex-end",
                          }}
                        >
                          <Link
                            component="button"
                            type="button"
                            onClick={() => setForgotPasswordOpen(true)}
                            sx={{
                              textDecoration: "none",
                              color: "primary.main",
                              fontSize: "0.875rem",
                              "&:hover": { textDecoration: "underline" },
                              cursor: "pointer",
                            }}
                          >
                            {t("auth.forgotPassword", { defaultValue: "Forgot Password?" })}
                          </Link>
                        </Box>
                        <Tooltip
                          title={
                            !isLoginValid
                              ? Object.keys(loginErrors).length > 0
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
                              disabled={isLoggingIn || !isLoginValid}
                              fullWidth
                              sx={{
                                py: 1.5,
                                fontSize: "1rem",
                                fontWeight: 600,
                                borderRadius: 2,
                              }}
                            >
                              {isLoggingIn
                                ? t("auth.loggingIn", { defaultValue: "Signing In..." })
                                : t("auth.login", { defaultValue: "Sign In" })}
                            </Button>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Box>
                  )}

                  {/* Register Form */}
                  {tabValue === 1 && (
                    <Box component="form" onSubmit={handleRegisterSubmit(onRegisterSubmit)} noValidate>
                      <Stack spacing={2.5}>
                        {registerError && (
                          <Alert severity="error" sx={{ borderRadius: 2 }}>
                            {registerError}
                          </Alert>
                        )}
                        <TextField
                          label={t("tenant.name", "Hospital Name")}
                          fullWidth
                          required
                          {...registerRegister("name")}
                          error={!!registerErrors.name}
                          helperText={registerErrors.name?.message}
                          size="medium"
                        />
                        <TextField
                          label={t("tenant.address", "Address")}
                          fullWidth
                          required
                          multiline
                          minRows={2}
                          {...registerRegister("address")}
                          error={!!registerErrors.address}
                          helperText={registerErrors.address?.message}
                          size="medium"
                        />
                        <TextField
                          label={t("tenant.contactEmail", "Contact Email")}
                          fullWidth
                          required
                          type="email"
                          {...registerRegister("contact_email")}
                          error={!!registerErrors.contact_email}
                          helperText={registerErrors.contact_email?.message}
                          size="medium"
                        />
                        <TextField
                          label={t("tenant.contactPhone", "Contact Phone")}
                          fullWidth
                          required
                          {...registerRegister("contact_phone")}
                          error={!!registerErrors.contact_phone}
                          helperText={registerErrors.contact_phone?.message}
                          size="medium"
                        />
                        <TextField
                          label={t("tenant.licenseNumber", "License Number")}
                          fullWidth
                          required
                          {...registerRegister("license_number")}
                          error={!!registerErrors.license_number}
                          helperText={registerErrors.license_number?.message}
                          size="medium"
                        />
                        <Tooltip
                          title={
                            !isRegisterValid
                              ? Object.keys(registerErrors).length > 0
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
                              disabled={isRegistering || !isRegisterValid}
                              fullWidth
                              sx={{
                                py: 1.5,
                                fontSize: "1rem",
                                fontWeight: 600,
                                borderRadius: 2,
                              }}
                            >
                              {isRegistering
                                ? t("common.saving", { defaultValue: "Registering..." })
                                : t("tenant.registerCta", "Register")}
                            </Button>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Box>
                  )}
                </Paper>
              </Grow>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features Section - Everything You Need */}
      <Box sx={{ py: { xs: 4, md: 6 }, backgroundColor: "background.paper" }}>
        <Container maxWidth="lg">
          <Fade in timeout={1000}>
            <Box sx={{ textAlign: "center", mb: 6 }}>
              <Typography
                variant="h2"
                fontWeight={700}
                sx={{ mb: 2, fontSize: { xs: "2rem", md: "2.75rem" } }}
              >
                {t("landing.features.title", { defaultValue: "Everything You Need – Simplified & Hospital-Focused" })}
              </Typography>
            </Box>
          </Fade>

          {/* Clinical Workflows */}
          <Box sx={{ mb: 6 }}>
            <Grid container spacing={3}>
              {clinicalWorkflows.map((feature, index) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                  <Grow in timeout={800 + index * 100}>
                    <Card
                      elevation={0}
                      sx={{
                        height: "100%",
                        borderRadius: 2,
                        border: "1px solid rgba(0, 0, 0, 0.08)",
                        "&:hover": {
                          borderColor: "primary.main",
                        },
                      }}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ mb: 2 }}>{feature.icon}</Box>
                        <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                          {feature.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" lineHeight={1.6}>
                          {feature.description}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grow>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Hospital Operations */}
          <Box sx={{ mb: 6 }}>
            <Grid container spacing={3}>
              {hospitalOperations.map((feature, index) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                  <Grow in timeout={800 + index * 100}>
                    <Card
                      elevation={0}
                      sx={{
                        height: "100%",
                        borderRadius: 2,
                        border: "1px solid rgba(0, 0, 0, 0.08)",
                        "&:hover": {
                          borderColor: "primary.main",
                        },
                      }}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ mb: 2 }}>{feature.icon}</Box>
                        <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                          {feature.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" lineHeight={1.6}>
                          {feature.description}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grow>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Platform Features */}
          <Box>
            <Grid container spacing={3}>
              {platformFeatures.map((feature, index) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                  <Grow in timeout={800 + index * 100}>
                    <Card
                      elevation={0}
                      sx={{
                        height: "100%",
                        borderRadius: 2,
                        border: "1px solid rgba(0, 0, 0, 0.08)",
                        "&:hover": {
                          borderColor: "primary.main",
                        },
                      }}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ mb: 2 }}>{feature.icon}</Box>
                        <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                          {feature.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" lineHeight={1.6}>
                          {feature.description}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grow>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Container>
      </Box>

      {/* Why Choose Section */}
      <Box
        sx={{
          py: { xs: 4, md: 6 },
          background: "linear-gradient(135deg, rgba(29, 122, 243, 0.03) 0%, rgba(0, 168, 107, 0.03) 100%)",
        }}
      >
        <Container maxWidth="lg">
          <Fade in timeout={1000}>
            <Box sx={{ textAlign: "center", mb: 6 }}>
              <Typography
                variant="h2"
                fontWeight={700}
                sx={{ mb: 2, fontSize: { xs: "2rem", md: "2.75rem" } }}
              >
                {t("landing.whyChoose.title", { defaultValue: "Why Choose Our HMS" })}
              </Typography>
            </Box>
          </Fade>
          <Grid container spacing={4}>
            {whyChoose.map((item, index) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                <Grow in timeout={800 + index * 100}>
                  <Card
                    elevation={0}
                    sx={{
                      height: "100%",
                      p: 3,
                      borderRadius: 3,
                      backgroundColor: "background.paper",
                      border: "1px solid rgba(0, 0, 0, 0.05)",
                      transition: "all 0.3s ease",
                      "&:hover": {
                        transform: "translateY(-4px)",
                        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.08)",
                      },
                    }}
                  >
                    <Box sx={{ mb: 2 }}>{item.icon}</Box>
                    <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
                      {item.description}
                    </Typography>
                  </Card>
                </Grow>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Product Preview Section */}
      <Box sx={{ py: { xs: 4, md: 6 }, backgroundColor: "background.paper" }}>
        <Container maxWidth="lg">
          <Fade in timeout={1000}>
            <Box sx={{ textAlign: "center", mb: 6 }}>
              <Typography
                variant="h2"
                fontWeight={700}
                sx={{ mb: 2, fontSize: { xs: "2rem", md: "2.75rem" } }}
              >
                {t("landing.preview.title", { defaultValue: "See It In Action" })}
              </Typography>
            </Box>
          </Fade>
          <Grid container spacing={4}>
            {/* Mini Dashboard */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Grow in timeout={1000}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 2,
                    backgroundColor: "background.paper",
                    border: "1px solid rgba(0, 0, 0, 0.08)",
                  }}
                >
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                    {t("landing.preview.dashboard.title", { defaultValue: "Dashboard" })}
                  </Typography>
                  <Stack spacing={2}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        backgroundColor: "rgba(29, 122, 243, 0.08)",
                      }}
                    >
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {t("landing.preview.dashboard.patients", { defaultValue: "Patients Today" })}
                      </Typography>
                      <Typography variant="h5" fontWeight={700} color="primary">
                        24
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        backgroundColor: "rgba(0, 168, 107, 0.08)",
                      }}
                    >
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {t("landing.preview.dashboard.appointments", { defaultValue: "Appointments" })}
                      </Typography>
                      <Typography variant="h5" fontWeight={700} color="secondary.main">
                        12
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        backgroundColor: "rgba(255, 152, 0, 0.08)",
                      }}
                    >
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {t("landing.preview.dashboard.doctors", { defaultValue: "Doctors on Duty" })}
                      </Typography>
                      <Typography variant="h5" fontWeight={700} sx={{ color: "warning.main" }}>
                        14
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Grow>
            </Grid>

            {/* Mini Patient List */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Grow in timeout={1200}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 2,
                    backgroundColor: "background.paper",
                    border: "1px solid rgba(0, 0, 0, 0.08)",
                  }}
                >
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                    {t("landing.preview.patients.title", { defaultValue: "Patient List" })}
                  </Typography>
                  <List dense>
                    {[1, 2, 3].map((i) => (
                      <ListItem
                        key={i}
                        sx={{
                          px: 0,
                          py: 1,
                          borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
                        }}
                      >
                        <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", mr: 2 }}>
                          {i}
                        </Avatar>
                        <ListItemText
                          primary={t("landing.preview.patients.name", { defaultValue: "Patient" }) + ` ${i}`}
                          secondary={t("landing.preview.patients.department", { defaultValue: "General" })}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Grow>
            </Grid>

            {/* Mini Appointment List */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Grow in timeout={1400}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 2,
                    backgroundColor: "background.paper",
                    border: "1px solid rgba(0, 0, 0, 0.08)",
                  }}
                >
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                    {t("landing.preview.appointments.title", { defaultValue: "Appointments" })}
                  </Typography>
                  <List dense>
                    {[1, 2, 3].map((i) => (
                      <ListItem
                        key={i}
                        sx={{
                          px: 0,
                          py: 1,
                          borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
                        }}
                      >
                        <ListItemText
                          primary={t("landing.preview.appointments.time", { defaultValue: "10:00 AM" })}
                          secondary={t("landing.preview.appointments.patient", { defaultValue: "Patient" }) + ` ${i}`}
                        />
                        <Chip label="Scheduled" size="small" color="primary" />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Grow>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Testimonials Section */}
      <Box
        sx={{
          py: { xs: 4, md: 6 },
          background: "linear-gradient(135deg, rgba(29, 122, 243, 0.05) 0%, rgba(0, 168, 107, 0.05) 100%)",
        }}
      >
        <Container maxWidth="lg">
          <Fade in timeout={1000}>
            <Box sx={{ textAlign: "center", mb: 6 }}>
              <Typography
                variant="h2"
                fontWeight={700}
                sx={{ mb: 2, fontSize: { xs: "2rem", md: "2.75rem" } }}
              >
                {t("landing.testimonials.title", { defaultValue: "Trusted by Healthcare Professionals" })}
              </Typography>
            </Box>
          </Fade>
          <Grid container spacing={4}>
            {testimonials.map((testimonial, index) => (
              <Grid size={{ xs: 12, md: 4 }} key={index}>
                <Grow in timeout={800 + index * 200}>
                  <Card
                    elevation={0}
                    sx={{
                      height: "100%",
                      p: 3,
                      borderRadius: 2,
                      backgroundColor: "background.paper",
                      border: "1px solid rgba(0, 0, 0, 0.08)",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <Typography
                      variant="body1"
                      sx={{ mb: 3, flexGrow: 1, fontStyle: "italic", lineHeight: 1.7 }}
                      color="text.secondary"
                    >
                      "{testimonial.quote}"
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Box>
                      <Typography variant="subtitle1" fontWeight={600}>
                        — {testimonial.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {testimonial.hospital}
                      </Typography>
                    </Box>
                  </Card>
                </Grow>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          py: 4,
          borderTop: "1px solid rgba(0, 0, 0, 0.08)",
          backgroundColor: "background.paper",
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid size={{ xs: 12, md: 4 }}>
              <Box display="flex" alignItems="center">
                <Box
                  component="img"
                  src={logoSrc}
                  alt="HMS Logo"
                  sx={{ height: 48, width: "auto" }}
                />
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Stack direction="row" spacing={1.5}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    navigate(AppRoutes.LOGIN);
                  }}
                  sx={{
                    fontSize: "0.75rem",
                    py: 0.5,
                    px: 1.5,
                    borderRadius: 1.5,
                    minWidth: "auto",
                  }}
                >
                  {t("landing.login", { defaultValue: "Login" })}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => {
                    navigate(AppRoutes.TENANT_REGISTER);
                  }}
                  sx={{
                    fontSize: "0.75rem",
                    py: 0.5,
                    px: 1.5,
                    borderRadius: 1.5,
                    minWidth: "auto",
                  }}
                >
                  {t("landing.getStarted", { defaultValue: "Get Started" })}
                </Button>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="body2" color="text.secondary">
                support@hms.varunanalytics.com
              </Typography>
            </Grid>
          </Grid>
          <Divider sx={{ my: 3 }} />
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {t("footer.caption", {
              defaultValue: "© {{year}} Hospital Management System. All rights reserved.",
              year: new Date().getFullYear(),
            })}
          </Typography>
        </Container>
      </Box>

      {/* Forgot Password Dialog */}
      <ForgotPasswordDialog
        open={forgotPasswordOpen}
        onClose={() => setForgotPasswordOpen(false)}
      />
    </Box>
  );
};

export default LandingPage;
