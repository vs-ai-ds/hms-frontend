// src/app/components/common/TaskProgressBar.tsx
import React from "react";
import {
  Box,
  LinearProgress,
  Typography,
  Paper,
  Alert,
  IconButton,
  Collapse,
  keyframes,
} from "@mui/material";
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useTaskStore, type ActiveTask } from "@app/store/taskStore";

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

interface TaskProgressBarProps {
  task: ActiveTask;
  onDismiss?: () => void;
  compact?: boolean;
}

const TaskProgressBar: React.FC<TaskProgressBarProps> = ({
  task,
  onDismiss,
  compact = false,
}) => {
  const { t } = useTranslation();

  const getActionLabel = (action: string) => {
    switch (action) {
      case "seed":
        return t("admin.seedDemoData", { defaultValue: "Seed Demo Data" });
      case "freshen":
        return t("admin.freshenDemoData", { defaultValue: "Freshen Demo Data" });
      case "reset":
        return t("admin.resetDemoData", { defaultValue: "Reset Demo Data" });
      default:
        return action;
    }
  };

  const isCompleted = task.status === "COMPLETED";
  const isFailed = task.status === "FAILED";
  const isRunning = task.status === "RUNNING";

  if (compact) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {isRunning && (
          <RefreshIcon
            sx={{
              fontSize: 16,
              animation: `${spin} 2s linear infinite`,
            }}
          />
        )}
        {isCompleted && <CheckCircleIcon color="success" sx={{ fontSize: 16 }} />}
        {isFailed && <ErrorIcon color="error" sx={{ fontSize: 16 }} />}
        <Typography variant="caption" sx={{ flex: 1 }}>
          {getActionLabel(task.action)}: {task.progress}%
        </Typography>
      </Box>
    );
  }

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        mb: 2,
        borderLeft: `4px solid ${
          isCompleted
            ? "success.main"
            : isFailed
            ? "error.main"
            : "primary.main"
        }`,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1,
            }}
          >
            <Typography variant="subtitle2" fontWeight={600}>
              {getActionLabel(task.action)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {task.progress}%
            </Typography>
          </Box>

          {isRunning && (
            <LinearProgress
              variant="determinate"
              value={task.progress}
              sx={{ mb: 1, height: 6, borderRadius: 1 }}
            />
          )}

          {isCompleted && (
            <Alert severity="success" sx={{ mb: 1 }}>
              {task.message || t("admin.taskCompleted", { defaultValue: "Task completed successfully" })}
            </Alert>
          )}

          {isFailed && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {task.error || t("admin.taskFailed", { defaultValue: "Task failed" })}
            </Alert>
          )}

          {task.message && !isCompleted && !isFailed && (
            <Typography variant="body2" color="text.secondary">
              {task.message}
            </Typography>
          )}
        </Box>

        {onDismiss && (isCompleted || isFailed) && (
          <IconButton size="small" onClick={onDismiss}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    </Paper>
  );
};

export default TaskProgressBar;
