import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { usePermissions } from './hooks/usePermissions';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Consultants from './pages/Consultants';
import Projects from './pages/Projects';
import Functions from './pages/Functions';
import StatusConfig from './pages/StatusConfig';
import Teams from './pages/Teams';
import ExternalData from './pages/ExternalData';
import Middleware from './pages/Middleware';
import Roles from './pages/Roles';
import SessionLogs from './pages/SessionLogs';
import Layout from './components/Layout/Layout';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initialized, mustChangePassword } = useAuthStore();

  // Aguarda inicialização
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ngr-secondary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Se precisa trocar senha, redireciona para tela de troca
  if (mustChangePassword) {
    return <Navigate to="/trocar-senha" replace />;
  }

  return <>{children}</>;
}

function RequirePasswordChange({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initialized, mustChangePassword } = useAuthStore();

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ngr-secondary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Se não precisa trocar senha, redireciona para home
  if (!mustChangePassword) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Componente de rota baseado em permissões (RBAC)
function PermissionRoute({ 
  children, 
  permission, 
  anyPermission 
}: { 
  children: React.ReactNode;
  permission?: string;
  anyPermission?: string[];
}) {
  const { user, isAuthenticated, initialized } = useAuthStore();
  const { hasPermission, hasAnyPermission, loading } = usePermissions();

  if (!initialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ngr-secondary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Fallback: admin antigo tem acesso a tudo
  if (user?.profile === 'admin' && !user?.role) {
    return <>{children}</>;
  }

  // Verificar permissão específica
  if (permission) {
    const hasAccess = hasPermission(permission);
    if (!hasAccess) {
      return <Navigate to="/" replace />;
    }
  }

  // Verificar qualquer uma das permissões
  if (anyPermission && anyPermission.length > 0) {
    const hasAccess = hasAnyPermission(...anyPermission);
    if (!hasAccess) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initialized, mustChangePassword } = useAuthStore();

  // Na página de login, não precisa esperar inicialização
  if (!initialized) {
    return <>{children}</>;
  }

  // Se já está autenticado, redireciona
  if (isAuthenticated) {
    if (mustChangePassword) {
      return <Navigate to="/trocar-senha" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { checkAuth, initialized } = useAuthStore();

  useEffect(() => {
    console.log('[APP] useEffect, initialized:', initialized);
    if (!initialized) {
      console.log('[APP] Chamando checkAuth...');
      checkAuth();
    }
  }, [initialized, checkAuth]);

  return (
    <BrowserRouter basename={import.meta.env.PROD ? '/agenda' : undefined}>
      <Routes>
        <Route path="/login" element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } />
        <Route 
          path="/trocar-senha" 
          element={
            <RequirePasswordChange>
              <ChangePassword />
            </RequirePasswordChange>
          } 
        />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="consultores" element={
            <PermissionRoute anyPermission={['users.manage', 'users.view']}>
              <Consultants />
            </PermissionRoute>
          } />
          <Route path="projetos" element={
            <PermissionRoute anyPermission={['projects.manage', 'projects.view', 'projects.create']}>
              <Projects />
            </PermissionRoute>
          } />
          <Route path="funcoes" element={
            <PermissionRoute permission="functions.manage">
              <Functions />
            </PermissionRoute>
          } />
          <Route path="status" element={
            <PermissionRoute permission="status.manage">
              <StatusConfig />
            </PermissionRoute>
          } />
          <Route path="equipes" element={
            <PermissionRoute permission="teams.manage">
              <Teams />
            </PermissionRoute>
          } />
          <Route path="perfis" element={
            <PermissionRoute permission="roles.manage">
              <Roles />
            </PermissionRoute>
          } />
          <Route path="dados-externos" element={
            <PermissionRoute permission="external-data.view">
              <ExternalData />
            </PermissionRoute>
          } />
          <Route path="middleware" element={
            <PermissionRoute anyPermission={['middleware.view', 'middleware.create', 'middleware.update', 'middleware.execute']}>
              <Middleware />
            </PermissionRoute>
          } />
          <Route path="logs-acesso" element={
            <PrivateRoute>
              <SessionLogs />
            </PrivateRoute>
          } />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
