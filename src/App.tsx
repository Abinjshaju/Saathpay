import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppShell from "@/components/layout/AppShell";
import LandingPage from "@/pages/LandingPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import MembersPage from "@/pages/MembersPage";
import MemberDetailPage from "@/pages/MemberDetailPage";
import AddMemberPage from "@/pages/AddMemberPage";
import SettingsPage from "@/pages/SettingsPage";
import ApiConfigPage from "@/pages/settings/ApiConfigPage";
import ExportDataPage from "@/pages/settings/ExportDataPage";
import AccountPage from "@/pages/settings/AccountPage";
import PaymentHistoryPage from "@/pages/PaymentHistoryPage";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected — all routes share AppShell so sidebar is always visible on desktop */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/payments" element={<PaymentHistoryPage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/members/new" element={<AddMemberPage />} />
          <Route path="/members/:id" element={<MemberDetailPage />} />
          <Route path="/members/:id/edit" element={<AddMemberPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/api" element={<ApiConfigPage />} />
          <Route path="/settings/export" element={<ExportDataPage />} />
          <Route path="/settings/account" element={<AccountPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
