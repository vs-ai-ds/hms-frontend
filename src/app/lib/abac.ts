// src/app/lib/abac.ts
import type { CurrentUser } from "@app/store/authStore";

export type PermissionCode = string;

export function getEffectivePermissions(
  user: CurrentUser | null
): Set<PermissionCode> {
  const result = new Set<PermissionCode>();
  if (!user) return result;

  // SUPER_ADMIN (tenant_id is null) - check if user has SUPER_ADMIN role
  const isSuperAdmin = user.tenant_id === null || 
    user.roles?.some((role) => role.name === "SUPER_ADMIN");
  
  if (isSuperAdmin) {
    // SUPER_ADMIN has platform-level permissions
    result.add("tenants:manage");
    result.add("dashboard:view");
    return result;
  }

  // Regular tenant users - get permissions from roles
  user.roles?.forEach((role) => {
    role.permissions?.forEach((p) => {
      if (p?.code) result.add(p.code);
    });
  });

  return result;
}

export function can(
  user: CurrentUser | null,
  permission: PermissionCode
): boolean {
  if (!user) return false;
  
  // SUPER_ADMIN (tenant_id is null or has SUPER_ADMIN role)
  const isSuperAdmin = user.tenant_id === null || 
    user.roles?.some((role) => role.name === "SUPER_ADMIN");
  
  if (isSuperAdmin) {
    // SUPER_ADMIN can access platform-level permissions
    if (permission === "tenants:manage" || permission === "dashboard:view") {
      return true;
    }
    // For tenant-scoped permissions, SUPER_ADMIN typically doesn't have access
    // unless explicitly granted (they manage tenants, not tenant data)
    return false;
  }
  
  const perms = getEffectivePermissions(user);
  return perms.has(permission);
}