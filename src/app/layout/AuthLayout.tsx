// src/app/layout/AuthLayout.tsx
import React from "react";
import { Outlet } from "react-router-dom";
import { Box, Container, Paper } from "@mui/material";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@app/components/common/LanguageSwitcher";
import Footer from "@app/components/layout/Footer";

const AuthLayout: React.FC = () => {
  const { t, i18n } = useTranslation();

  const logoSrc =
    i18n.language && i18n.language.startsWith("hi")
      ? "/logo-hi.svg"
      : "/logo.svg";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #f5f7fb 0%, #e8f0fe 30%, #ffffff 100%)",
        padding: 2,
        position: "relative",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "radial-gradient(circle at 20% 50%, rgba(29, 122, 243, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(0, 168, 107, 0.1) 0%, transparent 50%)",
          pointerEvents: "none",
        },
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={8}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: 4,
            border: "1px solid rgba(0, 0, 0, 0.08)",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
            maxWidth: 500,
            width: "100%",
            backgroundColor: "background.paper",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Header: logo (language-dependent) + language switcher */}
          <Box
            sx={{
              mb: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <Box
              component="img"
              src={logoSrc}
              alt={t("appTitle")}
              sx={{
                height: 50,
                width: "auto",
                flexShrink: 0,
              }}
            />
            <Box sx={{ ml: "auto" }}>
              <LanguageSwitcher />
            </Box>
          </Box>

          <Outlet />
          <Footer />
        </Paper>
      </Container>
    </Box>
  );
};

export default AuthLayout;