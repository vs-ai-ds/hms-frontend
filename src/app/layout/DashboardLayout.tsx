// src/app/layout/DashboardLayout.tsx
import React from "react";
import { Outlet } from "react-router-dom";
import { Box } from "@mui/material";
import Sidebar from "@app/components/navigation/Sidebar";
import TopBar from "@app/components/navigation/TopBar";
import Footer from "@app/components/layout/Footer";

const drawerWidth = 0;
const drawerWidthCollapsed = 0;
const sidebarGap = 16;

const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  return (
    <Box sx={{ display: "flex" }}>
      <TopBar />
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          pt: 2,
          mt: 8,
          backgroundColor: "#f5f7fb",
          minHeight: "calc(100vh - 64px)",
          display: "flex",
          flexDirection: "column",
          transition: (theme) =>
            theme.transitions.create("margin-left", {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
          marginLeft: sidebarOpen
            ? `${drawerWidth + sidebarGap}px`
            : `${drawerWidthCollapsed + sidebarGap}px`,
        }}
      >
        <Box sx={{ flexGrow: 1, width: "100%", maxWidth: "100%" }}>
          <Outlet />
        </Box>
        <Footer />
      </Box>
    </Box>
  );
};

export default DashboardLayout;