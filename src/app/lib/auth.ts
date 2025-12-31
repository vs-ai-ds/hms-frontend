// src/app/lib/auth.ts
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiClient } from "./apiClient";
import { AppRoutes } from "@app/routes";
import { useAuthStore, type CurrentUser } from "@app/store/authStore";

export function useAuthInit() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const setUserInStore = useAuthStore((s) => s.setUser);
  const setTokenInStore = useAuthStore((s) => s.setToken);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    const token = window.localStorage.getItem("access_token");
    if (!token) {
      setIsLoading(false);
      logout();
      // Don't redirect if we're already on landing page or other public pages
      if (
        location.pathname !== AppRoutes.LOGIN &&
        location.pathname !== AppRoutes.LANDING &&
        location.pathname !== AppRoutes.VERIFY_EMAIL &&
        location.pathname !== AppRoutes.RESET_PASSWORD &&
        location.pathname !== AppRoutes.FORGOT_PASSWORD &&
        !location.pathname.startsWith(AppRoutes.TENANT_REGISTER)
      ) {
        // Only redirect to login if we're on a protected route
        // If user just logged out, they should already be on landing page
        if (location.pathname.startsWith("/dashboard") || 
            location.pathname.startsWith("/patients") ||
            location.pathname.startsWith("/appointments") ||
            location.pathname.startsWith("/prescriptions") ||
            location.pathname.startsWith("/users")) {
          navigate(AppRoutes.LANDING, { replace: true });
        }
      }
      return;
    }

    apiClient
      .get<CurrentUser>("/auth/me")
      .then((res) => {
        const userData = res.data;
        
        // Check if user is inactive or must change password - force logout
        if (!userData || (userData as any).is_active === false) {
          window.localStorage.removeItem("access_token");
          logout();
          setIsLoading(false);
          navigate(AppRoutes.LOGIN, { replace: true });
          return;
        }
        
        setCurrentUser(userData);
        setUserInStore(userData);
        setTokenInStore(token);
        setIsLoading(false);
        
        // Check if user must change password - redirect to first-login page
        if (userData.must_change_password && location.pathname !== AppRoutes.FIRST_LOGIN_CHANGE_PASSWORD) {
          navigate(AppRoutes.FIRST_LOGIN_CHANGE_PASSWORD, { replace: true });
        }
      })
      .catch((error: any) => {
        // Check for 403 errors (suspended tenant, inactive user)
        if (error?.response?.status === 403) {
          window.localStorage.removeItem("access_token");
          logout();
          setIsLoading(false);
          // Show error message and redirect to login
          if (
            location.pathname !== AppRoutes.LANDING &&
            location.pathname !== AppRoutes.VERIFY_EMAIL &&
            !location.pathname.startsWith(AppRoutes.TENANT_REGISTER)
          ) {
            navigate(AppRoutes.LOGIN, { replace: true });
          }
          return;
        }
        
        window.localStorage.removeItem("access_token");
        logout();
        setIsLoading(false);
        if (
          location.pathname !== AppRoutes.LANDING &&
          location.pathname !== AppRoutes.VERIFY_EMAIL &&
          !location.pathname.startsWith(AppRoutes.TENANT_REGISTER)
        ) {
          navigate(AppRoutes.LOGIN, { replace: true });
        }
      });
  }, [navigate, location.pathname, setUserInStore, setTokenInStore, logout]);

  return { isLoading, currentUser };
}

export function setAccessToken(token: string) {
  window.localStorage.setItem("access_token", token);
  try {
    useAuthStore.getState().setToken(token);
  } catch {
    // ignore
  }
}

export function clearAccessToken() {
  window.localStorage.removeItem("access_token");
  try {
    useAuthStore.getState().logout();
  } catch {
    // ignore
  }
}