// src/app/components/common/ToastProvider.tsx
import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { Snackbar, Alert, AlertColor } from "@mui/material";

interface ToastContextType {
  showToast: (message: string, severity?: AlertColor, persistent?: boolean) => void;
  showSuccess: (message: string, persistent?: boolean) => void;
  showError: (message: string, persistent?: boolean) => void;
  showInfo: (message: string, persistent?: boolean) => void;
  showWarning: (message: string, persistent?: boolean) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
}

type ToastItem = {
  id: number;
  message: string;
  severity: AlertColor;
  persistent: boolean;
};

function toMessageString(msg: unknown): string {
  if (typeof msg === "string") return msg;
  if (msg == null) return "An error occurred";
  try {
    return String(msg);
  } catch {
    return "An error occurred";
  }
}

// Keep behavior similar to your current 4s default, but give long messages a bit more time.
// Persistent still means "until user closes".
function getAutoHideDurationMs(message: string, persistent: boolean): number | null {
  if (persistent) return null;

  const base = 4000;
  const extra = Math.min(6000, Math.max(0, Math.floor(message.length * 30)));
  return Math.min(10000, base + extra); // clamp 4s–10s
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<ToastItem>({
    id: 0,
    message: "",
    severity: "info",
    persistent: false,
  });

  // Queue prevents "latest toast overwrites previous toast immediately"
  const queueRef = useRef<ToastItem[]>([]);
  const idRef = useRef(1);

  // Dedupe helps when React.StrictMode double-invokes effects in dev
  // (or when the same toast fires twice rapidly)
  const lastToastRef = useRef<{ key: string; ts: number } | null>(null);

  const showNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) return;
    setCurrent(next);
    setOpen(true);
  }, []);

  const showToast = useCallback(
    (msg: string, sev: AlertColor = "info", persist: boolean = false) => {
      const messageStr = toMessageString(msg);

      const dedupeKey = `${sev}::${messageStr}`;
      const now = Date.now();
      const last = lastToastRef.current;

      // Drop exact duplicates within 800ms
      if (last && last.key === dedupeKey && now - last.ts < 800) {
        return;
      }
      lastToastRef.current = { key: dedupeKey, ts: now };

      const item: ToastItem = {
        id: idRef.current++,
        message: messageStr,
        severity: sev,
        persistent: persist,
      };

      if (open) {
        queueRef.current.push(item);
        return;
      }

      setCurrent(item);
      setOpen(true);
    },
    [open]
  );

  const showSuccess = useCallback(
    (msg: string, persist: boolean = false) => {
      showToast(msg, "success", persist);
    },
    [showToast]
  );

  const showError = useCallback(
    (msg: string, persist: boolean = false) => {
      showToast(msg, "error", persist);
    },
    [showToast]
  );

  const showInfo = useCallback(
    (msg: string, persist: boolean = false) => {
      showToast(msg, "info", persist);
    },
    [showToast]
  );

  const showWarning = useCallback(
    (msg: string, persist: boolean = false) => {
      showToast(msg, "warning", persist);
    },
    [showToast]
  );

  const handleClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === "clickaway") return;
    setOpen(false);
  };

  const handleExited = () => {
    // When the close transition finishes, show the next queued toast
    if (queueRef.current.length > 0) {
      showNext();
    }
  };

  const autoHideDuration = getAutoHideDurationMs(current.message, current.persistent);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showInfo, showWarning }}>
      {children}

      <Snackbar
        key={current.id} // ensures clean transition per message
        open={open}
        autoHideDuration={autoHideDuration}
        onClose={handleClose}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        TransitionProps={{
          timeout: { enter: 300, exit: 200 },
          onExited: handleExited,
        }}
        sx={{
          top: "80px !important",
          zIndex: 1400,
          "& .MuiSnackbarContent-root": {
            minWidth: "300px",
            maxWidth: "600px",
          },
        }}
      >
        <Alert
          onClose={handleClose}
          severity={current.severity}
          variant="filled"
          sx={{
            width: "100%",
            borderRadius: 3,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
            fontSize: "0.9375rem",
            fontWeight: 500,
            py: 1.5,
            px: 2,
            // Helps detailed messages wrap instead of looking cut off
            whiteSpace: "pre-line",
            wordBreak: "break-word",
          }}
        >
          {current.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
};