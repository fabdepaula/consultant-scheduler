import { useState, useEffect } from 'react';
import { Clock, User, Monitor, Search, RefreshCw } from 'lucide-react';
import { sessionLogsAPI } from '../services/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SessionLog {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  loginAt: string;
  logoutAt?: string;
  duration?: number;
  ipAddress?: string;
  userAgent?: string;
  active: boolean;
}

export default function SessionLogs() {
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await sessionLogsAPI.getAll({
        page,
        limit: 50,
        search: search || undefined,
      });
      setLogs(response.data.logs);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== '') {
        setPage(1);
        loadLogs();
      } else {
        loadLogs();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '-';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}min`;
  };

  const formatUserAgent = (ua?: string) => {
    if (!ua) return '-';
    // Simplificar user agent
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return ua.substring(0, 30) + '...';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          Logs de Acesso
        </h1>
        <p className="text-slate-600">
          Registro de acessos ao sistema (últimas 32 horas)
        </p>
      </div>

      {/* Busca */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou email..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ngr-primary focus:border-transparent"
            />
          </div>
          <button
            onClick={loadLogs}
            disabled={loading}
            className="px-4 py-2 bg-ngr-primary text-white rounded-lg hover:bg-ngr-secondary transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ngr-primary mx-auto"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            Nenhum log encontrado
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                      Usuário
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                      Login
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                      Logout
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                      Duração
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                      IP
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                      Navegador
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {logs.map((log) => (
                    <tr key={log._id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <div>
                            <div className="font-medium text-slate-800">
                              {log.userName}
                            </div>
                            <div className="text-sm text-slate-500">
                              {log.userEmail}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          {format(new Date(log.loginAt), "dd/MM/yyyy HH:mm", {
                            locale: ptBR,
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {log.logoutAt
                          ? format(new Date(log.logoutAt), "dd/MM/yyyy HH:mm", {
                              locale: ptBR,
                            })
                          : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatDuration(log.duration)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 font-mono">
                        {log.ipAddress || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                          <Monitor className="w-4 h-4 text-slate-400" />
                          {formatUserAgent(log.userAgent)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {log.active ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            Ativo
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                            Finalizado
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {pagination.pages > 1 && (
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Página {pagination.page} de {pagination.pages} (
                  {pagination.total} registros)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

