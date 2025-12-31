// src/app/components/common/LanguageSwitcher.tsx
import React from "react";
import { IconButton, Menu, MenuItem, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { LANG_STORAGE_KEY } from "../../../i18n";

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const changeLanguage = (lng: "en" | "hi") => {
    i18n.changeLanguage(lng);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lng);
      document.cookie = `hms_lang=${encodeURIComponent(
        lng
      )};path=/;max-age=${60 * 60 * 24 * 365}`;
    } catch {
      // ignore
    }
    setAnchorEl(null);
  };

  return (
    <>
      <IconButton
        color="inherit"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ ml: 1 }}
        size="large">
        <Typography fontWeight={700}>A | अ</Typography>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => changeLanguage("en")}>English</MenuItem>
        <MenuItem onClick={() => changeLanguage("hi")}>हिंदी</MenuItem>
      </Menu>
    </>
  );
};

export default LanguageSwitcher;