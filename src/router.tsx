// src/router.tsx
import React from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";

import { AppRoutes } from "@app/routes";
import { useAuthInit } from "@app/lib/auth";

import LoadingOverlay from "@app/components/common/LoadingOverlay";
import ProtectedRoute from "@app/components/layout/ProtectedRoute";

import AuthLayout from "@app/layout/AuthLayout";
import DashboardLayout from "@app/layout/DashboardLayout";

import LandingPage from "@app/features/landing/LandingPage";
import EmailVerificationPage from "@app/features/auth/EmailVerificationPage";
import LoginPage from "@app/features/auth/LoginPage";
import TenantRegisterPage from "@app/features/tenants/TenantRegisterPage";
import ForgotPasswordPage from "@app/features/auth/ForgotPasswordPage";
import ResetPasswordPage from "@app/features/auth/ResetPasswordPage";
import FirstLoginChangePasswordPage from "@app/features/auth/FirstLoginChangePasswordPage";

import DashboardPage from "@app/features/dashboard/DashboardPage";
import PatientsPage from "@app/features/patients/PatientsPage";
import PatientDetailPage from "@app/features/patients/PatientDetailPage";
import SharedPatientsPage from "@app/features/patients/SharedPatientsPage";
import SharingPage from "@app/features/sharing/SharingPage";
import AppointmentsPage from "@app/features/appointments/AppointmentsPage";
import PrescriptionsPage from "@app/features/prescriptions/PrescriptionsPage";
import UsersPage from "@app/features/users/UsersPage";
import ProfilePage from "@app/features/profile/ProfilePage";
import StockItemsPage from "@app/features/stock_items/StockItemsPage";
import DepartmentsPage from "@app/features/departments/DepartmentsPage";
import RolesPage from "@app/features/roles/RolesPage";
import TenantsManagementPage from "@app/features/platform/TenantsManagementPage";

// Auth init gate: keep your current "LoadingOverlay until auth init done" behavior
const AuthGate: React.FC = () => {
  const { isLoading } = useAuthInit();
  if (isLoading) return <LoadingOverlay />;
  return <Outlet />;
};

// Landing redirect behavior: same as current App.tsx
const LandingRoute: React.FC = () => {
  const { currentUser } = useAuthInit();
  return currentUser ? (
    <Navigate to={AppRoutes.DASHBOARD} replace />
  ) : (
    <LandingPage />
  );
};

export const router = createBrowserRouter(
  [
    {
      element: <AuthGate />,
      children: [
        { path: AppRoutes.LANDING, element: <LandingRoute /> },
        { path: AppRoutes.VERIFY_EMAIL, element: <EmailVerificationPage /> },

        {
          element: <AuthLayout />,
          children: [
            { path: AppRoutes.LOGIN, element: <LoginPage /> },
            { path: AppRoutes.TENANT_REGISTER, element: <TenantRegisterPage /> },
            { path: AppRoutes.FORGOT_PASSWORD, element: <ForgotPasswordPage /> },
            { path: AppRoutes.RESET_PASSWORD, element: <ResetPasswordPage /> },
            {
              path: AppRoutes.FIRST_LOGIN_CHANGE_PASSWORD,
              element: <FirstLoginChangePasswordPage />,
            },
          ],
        },

        {
          element: <DashboardLayout />,
          children: [
            {
              path: AppRoutes.DASHBOARD,
              element: (
                <ProtectedRoute requiredPermission="dashboard:view">
                  <DashboardPage />
                </ProtectedRoute>
              ),
            },
            {
              path: AppRoutes.PATIENTS,
              element: (
                <ProtectedRoute requiredPermission="patients:view">
                  <PatientsPage />
                </ProtectedRoute>
              ),
            },
            {
              path: AppRoutes.PATIENT_DETAIL,
              element: (
                <ProtectedRoute requiredPermission="patients:view">
                  <PatientDetailPage />
                </ProtectedRoute>
              ),
            },
            {
              path: AppRoutes.SHARED_PATIENTS,
              element: (
                <ProtectedRoute requiredPermission="sharing:view">
                  <SharedPatientsPage />
                </ProtectedRoute>
              ),
            },
            {
              path: AppRoutes.SHARING,
              element: (
                <ProtectedRoute requiredPermission="patients:view">
                  <SharingPage />
                </ProtectedRoute>
              ),
            },
            {
              path: AppRoutes.APPOINTMENTS,
              element: (
                <ProtectedRoute requiredPermission="appointments:view">
                  <AppointmentsPage />
                </ProtectedRoute>
              ),
            },
            {
              path: AppRoutes.PRESCRIPTIONS,
              element: (
                <ProtectedRoute requiredPermission="prescriptions:view">
                  <PrescriptionsPage />
                </ProtectedRoute>
              ),
            },
            {
              path: AppRoutes.USERS,
              element: (
                <ProtectedRoute requiredPermission="users:view">
                  <UsersPage />
                </ProtectedRoute>
              ),
            },
            { path: AppRoutes.PROFILE, element: <ProfilePage /> },
            {
              path: AppRoutes.STOCK_ITEMS,
              element: (
                <ProtectedRoute requiredPermission="stock_items:view">
                  <StockItemsPage />
                </ProtectedRoute>
              ),
            },
            {
              path: AppRoutes.DEPARTMENTS,
              element: (
                <ProtectedRoute requiredPermission="departments:view">
                  <DepartmentsPage />
                </ProtectedRoute>
              ),
            },
            {
              path: AppRoutes.ROLES,
              element: (
                <ProtectedRoute requiredPermission="roles:view">
                  <RolesPage />
                </ProtectedRoute>
              ),
            },
            {
              path: AppRoutes.PLATFORM_TENANTS,
              element: (
                <ProtectedRoute requiredPermission="tenants:manage">
                  <TenantsManagementPage />
                </ProtectedRoute>
              ),
            },
          ],
        },

        { path: "*", element: <Navigate to={AppRoutes.LANDING} replace /> },
      ],
    },
  ],
  {
    // fixes both warnings
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  }
);