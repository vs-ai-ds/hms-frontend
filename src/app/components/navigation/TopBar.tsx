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
  IconButton,
  keyframes,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import {
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppRoutes } from "@app/routes";
import LanguageSwitcher from "@app/components/common/LanguageSwitcher";
import { useAuthStore } from "@app/store/authStore";
import { useTaskStore } from "@app/store/taskStore";
import { getDemoRefreshStatus } from "@app/lib/api/admin";

const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

const POLL_MS = 1500;

function isTerminal(status?: string | null) {
  return status === "COMPLETED" || status === "FAILED";
}

function normalizeMessage(msg?: string | null) {
  if (!msg) return "Processing...";
  const m = msg.trim();
  const lower = m.toLowerCase();
  // Avoid showing backend instructions / task id hints in the UI
  if (lower.includes("task_id") || lower.includes("use task")) return "Processing...";
  return m;
}

function actionLabel(t: any, action?: string) {
  if (action === "seed") return t("admin.seedDemoData", { defaultValue: "Seeding Demo Data" });
  if (action === "freshen") return t("admin.freshenDemoData", { defaultValue: "Freshening Demo Data" });
  if (action === "reset") return t("admin.resetDemoData", { defaultValue: "Resetting Demo Data" });
  return t("admin.demoMaintenance", { defaultValue: "Demo Maintenance" });
}

function completionLabel(t: any, action?: string) {
  if (action === "seed") return t("admin.seedDemoData", { defaultValue: "Seed Demo Data" });
  if (action === "freshen") return t("admin.freshenDemoData", { defaultValue: "Freshen Demo Data" });
  if (action === "reset") return t("admin.resetDemoData", { defaultValue: "Reset Demo Data" });
  return t("admin.operation", { defaultValue: "Operation" });
}

const TopBar: React.FC = () => {
  const [userMenuAnchor, setUserMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [elapsedSeconds, setElapsedSeconds] = React.useState<number>(0);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const user = useAuthStore((s) => s.user);
  const { activeTask, updateTask, clearTask } = useTaskStore();

  // Calculate elapsed time client-side for smooth updates
  React.useEffect(() => {
    if (!activeTask || (activeTask.status !== "PENDING" && activeTask.status !== "RUNNING")) {
      setElapsedSeconds(0);
      return;
    }

    const startTime = activeTask.started_at 
      ? new Date(activeTask.started_at).getTime()
      : activeTask.created_at 
      ? new Date(activeTask.created_at).getTime()
      : Date.now();

    const updateElapsed = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      setElapsedSeconds(elapsed);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [activeTask?.started_at, activeTask?.created_at, activeTask?.status]);

  // IMPORTANT: only poll when we have a real server task id
  const taskId = activeTask?.taskId || null;

  const shouldPoll = React.useMemo(() => {
    if (!taskId) return false;
    return activeTask?.status === "PENDING" || activeTask?.status === "RUNNING";
  }, [taskId, activeTask?.status]);

  const query = useQuery({
    queryKey: ["demo-task-status-global", taskId],
    enabled: !!taskId && !!activeTask, // poll only when taskId exists and activeTask is set
    queryFn: async () => {
      if (!taskId) return null;
      try {
        return await getDemoRefreshStatus(taskId);
      } catch (error: any) {
        if (error?.response?.status === 404) {
          // Task vanished (cleanup / restarted backend). Clear UI.
          clearTask();
          return null;
        }
        throw error;
      }
    },
    refetchInterval: shouldPoll ? POLL_MS : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  React.useEffect(() => {
    const data: any = query.data;
    if (!data || !activeTask) return;

    // FIX: API likely returns task_id, not id
    const responseTaskId = data.task_id ?? data.id ?? null;

    // If response contains an id and it doesn't match current task, ignore
    if (responseTaskId && taskId && responseTaskId !== taskId) return;

    // Ensure progress is a number [0..100]
    const progressRaw = data.progress ?? activeTask.progress ?? 0;
    const progress = Math.max(0, Math.min(100, Number(progressRaw) || 0));

    updateTask({
      status: data.status ?? activeTask.status,
      progress,
      message: normalizeMessage(data.message ?? activeTask.message),
      error: data.error ?? null,
      started_at: data.started_at ?? activeTask.started_at ?? null,
      completed_at: data.completed_at ?? activeTask.completed_at ?? null,
    });

    // If task just completed, invalidate data that depends on it
    if (isTerminal(data.status)) {
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics-live"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics-trends"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, taskId]);

  // Force immediate refetch when real taskId is set
  React.useEffect(() => {
    if (!taskId) return;
    queryClient.invalidateQueries({ queryKey: ["demo-task-status-global", taskId] });
    // immediate pull (no delay)
    query.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

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

  const initials = (user?.first_name?.[0] ?? "") + (user?.last_name?.[0] ?? "");
  const primaryRole = user?.roles?.[0]?.name || "";
  const hospitalName = user?.tenant_name || "";

  const logoSrc =
    i18n.language && i18n.language.startsWith("hi") ? "/logo-hi.svg" : "/logo.svg";

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
      <Toolbar sx={{ minHeight: 72, alignItems: "center", py: 1 }}>
        {/* LEFT */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 240 }}>
          <Box
            component="img"
            src={logoSrc}
            alt="HMS Logo"
            sx={{ height: 40 }}
          />
          {hospitalName && (
            <Typography
              variant="h6"
              noWrap
              component="div"
              fontWeight={700}
              color="primary"
            >
              {hospitalName}
            </Typography>
          )}
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* RIGHT */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 240, justifyContent: "flex-end" }}>
          <LanguageSwitcher />

          <Box
            sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer" }}
            onClick={(e) => setUserMenuAnchor(e.currentTarget)}
          >
            <Box sx={{ textAlign: "right", display: { xs: "none", sm: "block" } }}>
              <Typography variant="body2" fontWeight={700}>
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
        </Box>
      </Toolbar>

      {/* Global Task Indicator - Floating over header from top */}
      {activeTask && (
        <Box
          sx={{
            position: "absolute",
            left: "50%",
            top: 0,
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: 2.5,
            py: 1.25,
            borderRadius: 3,
            bgcolor: activeTask.status === "COMPLETED"
              ? "success.main"
              : activeTask.status === "FAILED"
              ? "error.main"
              : "primary.main",
            color: "white",
            minWidth: 300,
            maxWidth: 460,
            boxShadow: 3,
            zIndex: (theme) => theme.zIndex.appBar + 1,
          }}
        >
          {(activeTask.status === "PENDING" || activeTask.status === "RUNNING") && (
            <RefreshIcon
              sx={{
                fontSize: 20,
                animation:
                  activeTask.status === "RUNNING" ? `${spin} 2s linear infinite` : "none",
                opacity: activeTask.status === "PENDING" ? 0.7 : 1,
              }}
            />
          )}
          {activeTask.status === "COMPLETED" && <CheckCircleIcon sx={{ fontSize: 20 }} />}
          {activeTask.status === "FAILED" && <ErrorIcon sx={{ fontSize: 20 }} />}

          <Box sx={{ flex: 1, minWidth: 0 }}>
            {(activeTask.status === "PENDING" || activeTask.status === "RUNNING") ? (
              <>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    mb: 0.5,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {actionLabel(t, activeTask.action)}
                </Typography>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Box
                    sx={{
                      flex: 1,
                      height: 6,
                      bgcolor: "rgba(255,255,255,0.3)",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      sx={{
                        height: "100%",
                        bgcolor: "white",
                        width: `${Math.max(0, Math.min(100, activeTask.progress ?? 0))}%`,
                        transition: "width 0.3s ease",
                        borderRadius: 3,
                      }}
                    />
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{ fontSize: "0.8rem", fontWeight: 800, minWidth: 44, textAlign: "right" }}
                  >
                    {Math.max(0, Math.min(100, activeTask.progress ?? 0))}%
                  </Typography>
                </Box>

                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "0.72rem",
                    opacity: 0.92,
                    mt: 0.5,
                    minHeight: "1.1rem",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {normalizeMessage(activeTask.message)} {elapsedSeconds > 0 && `(${elapsedSeconds}s)`}
                </Typography>
              </>
            ) : (
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
                {activeTask.status === "COMPLETED"
                  ? `${completionLabel(t, activeTask.action)} ${t("admin.completedSuccessfully", { defaultValue: "completed successfully" })}`
                  : `${t("admin.taskFailed", { defaultValue: "Task failed" })}: ${activeTask.error || ""}`}
              </Typography>
            )}
          </Box>

          {(activeTask.status === "COMPLETED" || activeTask.status === "FAILED") && (
            <IconButton
              size="small"
              onClick={clearTask}
              sx={{
                color: "white",
                "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
                ml: 0.5,
              }}
              title="Dismiss"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      )}
    </AppBar>
  );
};

export default TopBar;
