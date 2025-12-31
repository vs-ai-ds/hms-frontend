// src/app/components/layout/ProtectedRoute.tsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@app/store/authStore";
import { can, type PermissionCode } from "@app/lib/abac";
import { AppRoutes } from "@app/routes";

interface ProtectedRouteProps {
  requiredPermission: PermissionCode;
  children: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requiredPermission,
  children,
}) => {
  const user = useAuthStore((s) => s.user);

  // If somehow we got here without a user, send to login.
  if (!user) {
    return <Navigate to={AppRoutes.LOGIN} replace />;
  }

  // If user must change password, redirect to first-login page (unless already there)
  if (user.must_change_password && window.location.pathname !== AppRoutes.FIRST_LOGIN_CHANGE_PASSWORD) {
    return <Navigate to={AppRoutes.FIRST_LOGIN_CHANGE_PASSWORD} replace />;
  }

  // If user doesn't have required permission, send to dashboard (or a 403 page).
  if (!can(user, requiredPermission)) {
    return <Navigate to={AppRoutes.DASHBOARD} replace />;
  }

  return children;
};

export default ProtectedRoute;