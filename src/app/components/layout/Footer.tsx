// src/app/components/layout/Footer.tsx
import React from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

const Footer: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box
      component="footer"
      sx={{
        mt: 4,
        pt: 2,
        pb: 2,
        borderTop: "1px solid rgba(148, 163, 184, 0.4)",
        textAlign: "center",
        color: "text.secondary",
        fontSize: 12,
      }}
    >
      <Typography variant="body2">
        {t(
          "footer.caption",
          "© {{year}} Hospital Management System. All rights reserved.",
          { year: new Date().getFullYear() }
        )}
      </Typography>
    </Box>
  );
};

export default Footer;