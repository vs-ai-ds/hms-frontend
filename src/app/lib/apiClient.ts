// src/app/lib/apiClient.ts
import axios from "axios";
import { useAuthStore } from "@app/store/authStore";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;

  // Keep any existing headers intact
  config.headers = {
    ...(config.headers ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  return config;
});

// Auto-logout on auth/permission states that should kick user out
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const detail = error?.response?.data?.detail || "";

    // 401: token expired/invalid
    // 403: suspended tenant / inactive user (your existing logic)
    if (status === 401 || status === 403) {
      const shouldLogout =
        status === 401 ||
        detail.includes("suspended") ||
        detail.includes("inactive") ||
        detail.includes("Account is inactive");

      if (shouldLogout) {
        window.localStorage.removeItem("access_token");
        useAuthStore.getState().logout();

        if (window.location.pathname !== "/login" && window.location.pathname !== "/") {
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);