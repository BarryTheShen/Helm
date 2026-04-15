import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { AdminLayout } from './components/AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { SessionsPage } from './pages/SessionsPage';
import { AuditPage } from './pages/AuditPage';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { ComponentsPage } from './pages/ComponentsPage';
import { EditorPage } from './pages/EditorPage';
import { VariablesPage } from './pages/VariablesPage';
import { ActionsTriggersPage } from './pages/ActionsTriggersPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token);
  const isLoading = useAuthStore(s => s.isLoading);
  if (isLoading) return <div className="p-6 text-gray-500">Loading...</div>;
  if (!token) return <Navigate to="/login" />;
  return <>{children}</>;
}

export default function App() {
  const initialize = useAuthStore(s => s.initialize);
  useEffect(() => { initialize(); }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/components" element={<ComponentsPage />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/variables" element={<VariablesPage />} />
          <Route path="/actions-triggers" element={<ActionsTriggersPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
