// src/app/components/navigation/TopBar.tsx
import React from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Avatar,
  Menu,
  MenuItem
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import TranslateIcon from "@mui/icons-material/Translate";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { clearAccessToken } from "@app/lib/auth";
import { AppRoutes } from "@app/routes";

const TopBar: React.FC = () => {
  const [userMenuAnchor, setUserMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [langAnchor, setLangAnchor] = React.useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const handleLogout = () => {
    clearAccessToken();
    navigate(AppRoutes.LOGIN, { replace: true });
  };

  const changeLanguage = (lng: "en" | "hi") => {
    i18n.changeLanguage(lng);
    setLangAnchor(null);
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: "#ffffff",
        color: "text.primary",
        boxShadow: "0 2px 8px rgba(15,23,42,0.08)"
      }}
    >
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          {t("appTitle")}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />

        {/* Language toggle */}
        <IconButton
          color="inherit"
          onClick={(e) => setLangAnchor(e.currentTarget)}
          sx={{ mr: 1 }}
        >
          <TranslateIcon />
        </IconButton>
        <Menu
          anchorEl={langAnchor}
          open={Boolean(langAnchor)}
          onClose={() => setLangAnchor(null)}
        >
          <MenuItem onClick={() => changeLanguage("en")}>English</MenuItem>
          <MenuItem onClick={() => changeLanguage("hi")}>हिंदी</MenuItem>
        </Menu>

        {/* User avatar + logout */}
        <IconButton
          color="inherit"
          onClick={(e) => setUserMenuAnchor(e.currentTarget)}
          sx={{ p: 0 }}
        >
          <Avatar sx={{ bgcolor: "#1d7af3" }}>DR</Avatar>
        </IconButton>
        <Menu
          anchorEl={userMenuAnchor}
          open={Boolean(userMenuAnchor)}
          onClose={() => setUserMenuAnchor(null)}
        >
          <MenuItem onClick={handleLogout}>
            <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
            Logout
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;