// src/app/lib/rbac.ts

/**
 * Basic role checks
 */
export function hasRole(userRoles: string[], requiredRole: string): boolean {
  return userRoles.includes(requiredRole);
}

/**
 * Check if user has ANY role from list
 */
export function hasAnyRole(
  userRoles: string[],
  allowed: string[]
): boolean {
  return allowed.some((r) => userRoles.includes(r));
}

/**
 * Role groups used by menu and screens
 */
export const RoleGroups = {
  DASHBOARD: ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "NURSE", "PHARMACIST", "RECEPTIONIST"],

  PATIENTS: ["HOSPITAL_ADMIN", "DOCTOR", "NURSE"],

  APPOINTMENTS: ["HOSPITAL_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"],

  PRESCRIPTIONS: ["DOCTOR", "PHARMACIST"],

  USERS: ["HOSPITAL_ADMIN"],
};