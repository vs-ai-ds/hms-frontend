// src/app/layout/AuthLayout.tsx
import React from "react";
import { Outlet } from "react-router-dom";
import { Box, Container, Paper, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

const AuthLayout: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at top left, #1d7af3 0, #f5f7fb 50%, #ffffff 100%)"
      }}
    >
      <Container maxWidth="sm">
        <Paper elevation={6} sx={{ p: 4, borderRadius: 4 }}>
          <Box sx={{ mb: 3, textAlign: "center" }}>
            <Typography variant="h4" fontWeight={700}>
              {t("appTitle")}
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              {t("appSubtitle")}
            </Typography>
          </Box>
          <Outlet />
        </Paper>
      </Container>
    </Box>
  );
};

export default AuthLayout;