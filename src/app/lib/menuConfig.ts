// src/app/lib/menuConfig.ts
import { AppRoutes } from "@app/routes";
import type { PermissionCode } from "./abac";

export type NavKey =
  | "dashboard"
  | "patients"
  | "shared_patients"
  | "appointments"
  | "prescriptions"
  | "users"
  | "departments"
  | "roles"
  | "stock_items"
  | "platform_tenants";

export interface NavItemConfig {
  key: NavKey;
  labelKey: string;
  path: string;
  permission: PermissionCode;
}

export const navItemsConfig: NavItemConfig[] = [
  {
    key: "dashboard",
    labelKey: "nav.dashboard",
    path: AppRoutes.DASHBOARD,
    permission: "dashboard:view", // <-- must match backend permission.code
  },
  {
    key: "patients",
    labelKey: "nav.patients",
    path: AppRoutes.PATIENTS,
    permission: "patients:view",
  },
  {
    key: "shared_patients",
    labelKey: "nav.sharedPatients",
    path: AppRoutes.SHARED_PATIENTS,
    permission: "sharing:view",
  },
  {
    key: "appointments",
    labelKey: "nav.appointments",
    path: AppRoutes.APPOINTMENTS,
    permission: "appointments:view",
  },
  {
    key: "prescriptions",
    labelKey: "nav.prescriptions",
    path: AppRoutes.PRESCRIPTIONS,
    permission: "prescriptions:view",
  },
  {
    key: "users",
    labelKey: "nav.users",
    path: AppRoutes.USERS,
    permission: "users:view",
  },
  {
    key: "departments",
    labelKey: "nav.departments",
    path: AppRoutes.DEPARTMENTS,
    permission: "departments:view",
  },
  {
    key: "roles",
    labelKey: "nav.roles",
    path: AppRoutes.ROLES,
    permission: "roles:view",
  },
  {
    key: "stock_items",
    labelKey: "nav.stockItems",
    path: AppRoutes.STOCK_ITEMS,
    permission: "stock_items:view",
  },
  {
    key: "platform_tenants",
    labelKey: "nav.platformTenants",
    path: AppRoutes.PLATFORM_TENANTS,
    permission: "tenants:manage",
  },
];