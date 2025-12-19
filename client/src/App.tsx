import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
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

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, initialized } = useAuthStore();

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

  if (user?.profile !== 'admin') {
    return <Navigate to="/" replace />;
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
    <BrowserRouter>
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
            <AdminRoute>
              <Consultants />
            </AdminRoute>
          } />
          <Route path="projetos" element={
            <AdminRoute>
              <Projects />
            </AdminRoute>
          } />
          <Route path="funcoes" element={
            <AdminRoute>
              <Functions />
            </AdminRoute>
          } />
          <Route path="status" element={
            <AdminRoute>
              <StatusConfig />
            </AdminRoute>
          } />
          <Route path="equipes" element={
            <AdminRoute>
              <Teams />
            </AdminRoute>
          } />
          <Route path="dados-externos" element={
            <AdminRoute>
              <ExternalData />
            </AdminRoute>
          } />
          <Route path="middleware" element={
            <AdminRoute>
              <Middleware />
            </AdminRoute>
          } />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
