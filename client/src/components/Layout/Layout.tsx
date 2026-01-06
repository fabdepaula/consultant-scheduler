import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  FolderKanban,
  LogOut,
  Menu,
  X,
  User,
  Settings,
  Palette,
  Users2,
  ChevronLeft,
  ChevronRight,
  Database,
  Activity,
  Shield
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false); // Para mobile
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    // Carregar preferência do localStorage, padrão: colapsado
    const saved = localStorage.getItem('sidebarExpanded');
    return saved ? saved === 'true' : false;
  });
  const { user, logout } = useAuthStore();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();

  // Salvar preferência no localStorage
  useEffect(() => {
    localStorage.setItem('sidebarExpanded', sidebarExpanded.toString());
  }, [sidebarExpanded]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Verificar permissões usando RBAC (com fallback para admin antigo)
  const isAdmin = user?.profile === 'admin';
  const canManageUsers = isAdmin || hasPermission('users.manage') || hasPermission('users.view');
  const canManageProjects = isAdmin || hasPermission('projects.manage') || hasPermission('projects.view') || hasPermission('projects.create');
  const canManageFunctions = isAdmin || hasPermission('functions.manage');
  const canManageTeams = isAdmin || hasPermission('teams.manage');
  const canManageStatus = isAdmin || hasPermission('status.manage');
  const canManageRoles = isAdmin || hasPermission('roles.manage');
  const canViewExternalData = isAdmin || hasPermission('external-data.view');
  const canManageMiddleware = isAdmin || hasPermission('middleware.view') || hasPermission('middleware.create') || hasPermission('middleware.update') || hasPermission('middleware.execute');

  const navItems = [
    { to: '/', icon: Calendar, label: 'Agenda' },
    ...(canManageUsers ? [{ to: '/consultores', icon: Users, label: 'Usuários' }] : []),
    ...(canManageProjects ? [{ to: '/projetos', icon: FolderKanban, label: 'Projetos' }] : []),
    ...(canManageFunctions ? [{ to: '/funcoes', icon: Settings, label: 'Funções' }] : []),
    ...(canManageTeams ? [{ to: '/equipes', icon: Users2, label: 'Equipes' }] : []),
    ...(canManageStatus ? [{ to: '/status', icon: Palette, label: 'Status' }] : []),
    ...(canManageRoles ? [{ to: '/perfis', icon: Shield, label: 'Perfis' }] : []),
    ...(canViewExternalData ? [{ to: '/dados-externos', icon: Database, label: 'Dados Externos' }] : []),
    ...(canManageMiddleware ? [{ to: '/middleware', icon: Activity, label: 'Middleware' }] : []),
  ];

  return (
    <div className="h-screen flex overflow-hidden bg-slate-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        bg-ngr-primary text-white
        transform transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${sidebarExpanded ? 'w-64' : 'w-20'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo NGR Global */}
          <div className={`flex items-center gap-3 border-b border-ngr-secondary/30 transition-all duration-300 ${
            sidebarExpanded ? 'px-6 py-5' : 'px-3 py-5 justify-center'
          }`}>
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-ngr-primary font-bold text-sm">NGR</span>
            </div>
            {sidebarExpanded && (
              <div className="flex-1 min-w-0">
                <h1 className="font-bold text-white">NGR GLOBAL</h1>
                <p className="text-xs text-blue-200">Agenda de Consultores</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              {/* Botão expandir/recolher (apenas desktop) */}
              <button 
                className="hidden lg:flex text-blue-200 hover:text-white hover:bg-white/10 rounded-lg p-1 transition-colors"
                onClick={() => setSidebarExpanded(!sidebarExpanded)}
                title={sidebarExpanded ? 'Recolher menu' : 'Expandir menu'}
              >
                {sidebarExpanded ? (
                  <ChevronLeft className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
              </button>
              {/* Botão fechar (apenas mobile) */}
              <button 
                className="lg:hidden text-blue-200 hover:text-white"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className={`flex-1 py-6 space-y-2 transition-all duration-300 ${
            sidebarExpanded ? 'px-4' : 'px-2'
          }`}>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `
                  flex items-center gap-3 rounded-xl transition-all duration-200
                  ${isActive 
                    ? 'bg-white/20 text-white border border-white/30' 
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }
                  ${sidebarExpanded ? 'px-4 py-3' : 'px-3 py-3 justify-center'}
                `}
                title={!sidebarExpanded ? item.label : ''}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {sidebarExpanded && (
                  <span className="font-medium whitespace-nowrap">{item.label}</span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* User section */}
          <div className={`py-4 border-t border-ngr-secondary/30 transition-all duration-300 ${
            sidebarExpanded ? 'px-4' : 'px-2'
          }`}>
            <div className={`flex items-center gap-3 bg-white/10 rounded-xl mb-3 transition-all duration-300 ${
              sidebarExpanded ? 'px-4 py-3' : 'px-3 py-3 justify-center'
            }`}>
              <div className="w-10 h-10 bg-ngr-accent rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-white" />
              </div>
              {sidebarExpanded && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                  <p className="text-xs text-blue-200 capitalize">
                    {user?.profile === 'admin' ? 'Administrador' : 'Usuário'}
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-3 text-blue-100 hover:text-red-300 hover:bg-red-500/20 rounded-xl transition-all duration-200 ${
                sidebarExpanded ? 'px-4 py-3' : 'px-3 py-3 justify-center'
              }`}
              title={!sidebarExpanded ? 'Sair' : ''}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {sidebarExpanded && (
                <span className="font-medium">Sair</span>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-4 px-6 py-4 bg-white border-b border-slate-200 lg:hidden">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="text-slate-600 hover:text-ngr-primary"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-ngr-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">NGR</span>
            </div>
            <h1 className="font-bold text-ngr-primary">NGR GLOBAL</h1>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto bg-slate-50 relative">
          {/* Botão flutuante para expandir menu (apenas desktop quando colapsado) */}
          {!sidebarExpanded && (
            <button
              onClick={() => setSidebarExpanded(true)}
              className="hidden lg:flex fixed left-2 top-4 z-40 bg-ngr-primary text-white p-2 rounded-lg shadow-lg hover:bg-ngr-secondary transition-all duration-200 hover:scale-110"
              title="Expandir menu"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
