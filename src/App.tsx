import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { Forbidden } from './components/ui';
import { usePermissions, useSessionReady } from './data/store';
import type { Permission } from './data/types';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import CustomerForm from './pages/CustomerForm';
import Leads from './pages/Leads';
import LeadDetail from './pages/LeadDetail';
import LeadForm from './pages/LeadForm';
import Payments from './pages/Payments';
import Packages from './pages/Packages';
import Tasks from './pages/Tasks';
import Reports from './pages/Reports';
import UsersPage from './pages/Users';
import SettingsPage from './pages/Settings';

function Guard({ perm, children }: { perm: Permission; children: ReactNode }) {
  const { can } = usePermissions();
  return can(perm) ? <>{children}</> : <Forbidden />;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = usePermissions();
  const ready = useSessionReady();
  const loc = useLocation();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Guard perm="dashboard.view"><Dashboard /></Guard>} />
        <Route path="customers" element={<Guard perm="customers.view"><Customers /></Guard>} />
        <Route path="customers/new" element={<Guard perm="customers.create"><CustomerForm /></Guard>} />
        <Route path="customers/:id" element={<Guard perm="customers.view"><CustomerDetail /></Guard>} />
        <Route path="customers/:id/edit" element={<Guard perm="customers.edit"><CustomerForm /></Guard>} />
        <Route path="leads" element={<Guard perm="leads.view"><Leads /></Guard>} />
        <Route path="leads/new" element={<Guard perm="leads.create"><LeadForm /></Guard>} />
        <Route path="leads/:id" element={<Guard perm="leads.view"><LeadDetail /></Guard>} />
        <Route path="leads/:id/edit" element={<Guard perm="leads.edit"><LeadForm /></Guard>} />
        <Route path="payments" element={<Guard perm="payments.view"><Payments /></Guard>} />
        <Route path="packages" element={<Guard perm="packages.view"><Packages /></Guard>} />
        <Route path="tasks" element={<Guard perm="tasks.view"><Tasks /></Guard>} />
        <Route path="reports" element={<Guard perm="reports.view"><Reports /></Guard>} />
        <Route path="users" element={<Guard perm="users.manage"><UsersPage /></Guard>} />
        <Route path="settings" element={<Guard perm="settings.manage"><SettingsPage /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
