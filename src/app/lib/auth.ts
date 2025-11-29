import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiClient } from "./apiClient";
import { AppRoutes } from "@app/routes";

export interface CurrentUser {
  id: string;
  tenant_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  roles: string[];
  department: string | null;
  specialization: string | null;
}

export function useAuthInit() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = window.localStorage.getItem("access_token");
    if (!token) {
      setIsLoading(false);
      if (location.pathname !== AppRoutes.LOGIN && !location.pathname.startsWith(AppRoutes.TENANT_REGISTER)) {
        navigate(AppRoutes.LOGIN, { replace: true });
      }
      return;
    }

    apiClient
      .get<CurrentUser>("/auth/me")
      .then((res) => {
        setCurrentUser(res.data);
        setIsLoading(false);
      })
      .catch(() => {
        window.localStorage.removeItem("access_token");
        setIsLoading(false);
        if (!location.pathname.startsWith(AppRoutes.TENANT_REGISTER)) {
          navigate(AppRoutes.LOGIN, { replace: true });
        }
      });
  }, [navigate, location.pathname]);

  return { isLoading, currentUser };
}

export function setAccessToken(token: string) {
  window.localStorage.setItem("access_token", token);
}

export function clearAccessToken() {
  window.localStorage.removeItem("access_token");
}