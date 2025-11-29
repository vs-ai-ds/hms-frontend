import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthInit } from "@app/lib/auth";
import { AppRoutes } from "@app/routes";
import AuthLayout from "@app/layout/AuthLayout";
import DashboardLayout from "@app/layout/DashboardLayout";
import LoginPage from "@app/features/auth/LoginPage";
import TenantRegisterPage from "@app/features/tenants/TenantRegisterPage";
import DashboardPage from "@app/features/dashboard/DashboardPage";
import PatientsPage from "@app/features/patients/PatientsPage";
import LoadingOverlay from "@app/components/common/LoadingOverlay";

const App: React.FC = () => {
  const { isLoading } = useAuthInit();

  if (isLoading) {
    return <LoadingOverlay />;
  }

  return (
    <Routes>
      {/* Public / auth routes */}
      <Route element={<AuthLayout />}>
        <Route path={AppRoutes.LOGIN} element={<LoginPage />} />
        <Route path={AppRoutes.TENANT_REGISTER} element={<TenantRegisterPage />} />
      </Route>

      {/* Protected app routes */}
      <Route element={<DashboardLayout />}>
        <Route path={AppRoutes.DASHBOARD} element={<DashboardPage />} />
        <Route path={AppRoutes.PATIENTS} element={<PatientsPage />} />
      </Route>

      <Route path="*" element={<Navigate to={AppRoutes.DASHBOARD} replace />} />
    </Routes>
  );
};

export default App;