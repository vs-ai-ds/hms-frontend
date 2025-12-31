// src/app/components/navigation/Sidebar.tsx
import React from "react";
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import EventIcon from "@mui/icons-material/Event";
import LocalPharmacyIcon from "@mui/icons-material/LocalPharmacy";
import PersonIcon from "@mui/icons-material/Person";
import BusinessIcon from "@mui/icons-material/Business";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import InventoryIcon from "@mui/icons-material/Inventory";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import MenuIcon from "@mui/icons-material/Menu";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Tooltip from "@mui/material/Tooltip";

import { navItemsConfig, NavKey } from "@app/lib/menuConfig";
import { useAuthStore } from "@app/store/authStore";
import { can } from "@app/lib/abac";

const drawerWidth = 220;
const drawerWidthCollapsed = 72;

const iconForKey = (key: NavKey): React.ReactElement => {
  switch (key) {
    case "dashboard":
      return <DashboardIcon />;
    case "patients":
      return <PeopleIcon />;
    case "appointments":
      return <EventIcon />;
    case "prescriptions":
      return <LocalPharmacyIcon />;
    case "users":
      return <PersonIcon />;
    case "departments":
      return <BusinessIcon />;
    case "roles":
      return <AssignmentIndIcon />;
    case "stock_items":
      return <InventoryIcon />;
    case "platform_tenants":
      return <BusinessIcon />;
    default:
      return <DashboardIcon />;
  }
};

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ open, onToggle }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const visibleItems = navItemsConfig.filter((item) =>
    can(user, item.permission)
  );

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: open ? drawerWidth : drawerWidthCollapsed,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: open ? drawerWidth : drawerWidthCollapsed,
          boxSizing: "border-box",
          borderRight: "1px solid rgba(0, 0, 0, 0.08)",
          backgroundColor: "#ffffff",
          boxShadow: "2px 0 8px rgba(0, 0, 0, 0.05)",
          overflow: "visible",        // Critical: allows button to stick out
          top: "64px",
          height: "calc(100vh - 64px)",
          position: "fixed",
        },
      }}
    >
      {/* Floating Toggle Button – Half inside, half outside */}
      <Tooltip
        title={open ? t("sidebar.collapse") : t("sidebar.expand")}
        placement="right"
      >
        <IconButton
          onClick={onToggle}
          sx={{
            position: "absolute",
            top: 16,
            right: open ? -14 : -14,
            transform: "translateX(50%)",
            zIndex: 1301,
            width: 36,
            height: 36,
            backgroundColor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            color: "primary.main",
            boxShadow: 4,
            backdropFilter: "blur(10px)",

            "&:hover": {
              backgroundColor: "background.main",
              color: "white",
              boxShadow: 8,
              transform: "translateX(50%) scale(1.1)",
            },
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          size="large">
          {open ? <MenuOpenIcon /> : <MenuIcon />}
        </IconButton>
      </Tooltip>
      <Box sx={{ height: "100%", overflowY: "auto", overflowX: "hidden" }}>
        <List sx={{ pt: 2, pb: 2 }}>
          {visibleItems.map((item) => {
            const selected = location.pathname === item.path;
            return (
              <ListItemButton
                key={item.key}
                selected={selected}
                onClick={() => navigate(item.path)}
                sx={{
                  borderRadius: 2,
                  mx: 1,
                  my: 0.5,
                  minHeight: 48,
                  justifyContent: open ? "initial" : "center",
                  px: open ? 2.5 : 1.5,
                  "&.Mui-selected": {
                    backgroundColor: "primary.main",
                    color: "white",
                    "& .MuiListItemIcon-root": { color: "white" },
                    "&:hover": {
                      backgroundColor: "primary.dark",
                    },
                  },
                  "&:hover": {
                    backgroundColor: "rgba(9, 80, 172, 0.08)",
                  },
                }}
                title={!open ? t(item.labelKey) : undefined}
              >
                <ListItemIcon
                  sx={{
                    minWidth: open ? 40 : 0,
                    justifyContent: "center",
                    color: selected ? "white" : "text.secondary",
                  }}
                >
                  {iconForKey(item.key)}
                </ListItemIcon>
                {open && <ListItemText primary={t(item.labelKey)} />}
              </ListItemButton>
            );
          })}
        </List>
      </Box>
    </Drawer>
  );
};

export default Sidebar;