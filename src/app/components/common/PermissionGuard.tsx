// src/app/components/common/PermissionGuard.tsx
import React from "react";
import { useAuthStore } from "@app/store/authStore";
import { can, type PermissionCode } from "@app/lib/abac";

interface PermissionGuardProps {
  permission: PermissionCode;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  children,
  fallback = null,
}) => {
  const user = useAuthStore((s) => s.user);

  if (!can(user, permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default PermissionGuard;