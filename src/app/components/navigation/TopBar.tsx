// src/app/components/navigation/TopBar.tsx
import React from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Divider,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppRoutes } from "@app/routes";
import LanguageSwitcher from "@app/components/common/LanguageSwitcher";
import { useAuthStore } from "@app/store/authStore";

const TopBar: React.FC = () => {
  const [userMenuAnchor, setUserMenuAnchor] =
    React.useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const handleLogout = () => {
    const logout = useAuthStore.getState().logout;
    logout();
    window.localStorage.removeItem("access_token");
    setUserMenuAnchor(null);
    navigate(AppRoutes.LANDING, { replace: true });
  };

  const handleProfile = () => {
    setUserMenuAnchor(null);
    navigate(AppRoutes.PROFILE);
  };

  const initials =
    (user?.first_name?.[0] ?? "") + (user?.last_name?.[0] ?? "");
  
  const primaryRole = user?.roles?.[0]?.name || "";
  const hospitalName = user?.tenant_name || "";

  const logoSrc =
    i18n.language && i18n.language.startsWith("hi")
      ? "/logo-hi.svg"
      : "/logo.svg";

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: "background.paper",
        color: "text.primary",
        borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
      }}
    >
      <Toolbar>
        {/* Logo */}
        <Box
          component="img"
          src={logoSrc}
          alt="HMS Logo"
          sx={{
            height: 40,
            mr: 2,
          }}
        />
        
        {/* Hospital Name - Prominently displayed */}
        {hospitalName && (
          <Typography
            variant="h6"
            noWrap
            component="div"
            fontWeight={700}
            color="primary"
            sx={{ mr: 3 }}
          >
            {hospitalName}
          </Typography>
        )}

        <Box sx={{ flexGrow: 1 }} />

        {/* Language toggle */}
        <LanguageSwitcher />

        {/* User info + menu */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            ml: 2,
            cursor: "pointer",
          }}
          onClick={(e) => setUserMenuAnchor(e.currentTarget)}
        >
          <Box sx={{ textAlign: "right", display: { xs: "none", sm: "block" } }}>
            <Typography variant="body2" fontWeight={600}>
              {user?.first_name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {primaryRole}
            </Typography>
          </Box>
          <Avatar
            sx={{
              bgcolor: "primary.main",
              width: 36,
              height: 36,
              fontSize: "0.875rem",
            }}
          >
            {initials || "DR"}
          </Avatar>
        </Box>

        <Menu
          anchorEl={userMenuAnchor}
          open={Boolean(userMenuAnchor)}
          onClose={() => setUserMenuAnchor(null)}
        >
          <MenuItem onClick={handleProfile}>
            <PersonIcon fontSize="small" sx={{ mr: 1 }} />
            {t("nav.profile", { defaultValue: "Profile" })}
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout}>
            <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
            {t("auth.logout", { defaultValue: "Logout" })}
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;