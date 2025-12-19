import { useState, useEffect } from 'react';
import { externalDataAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Database, RefreshCw, AlertCircle, CheckCircle2, Loader2, X, Table2 } from 'lucide-react';

interface View {
  view_name: string;
}

interface ViewStructure {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  column_comment: string | null;
}

export default function ExternalData() {
  const { user, isAuthenticated } = useAuthStore();
  const [views, setViews] = useState<View[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  
  // Estados para o modal de estrutura
  const [selectedView, setSelectedView] = useState<string | null>(null);
  const [viewStructure, setViewStructure] = useState<ViewStructure[]>([]);
  const [isLoadingStructure, setIsLoadingStructure] = useState(false);
  const [structureError, setStructureError] = useState('');

  const fetchViews = async () => {
    // Verifica autenticação antes de buscar
    if (!isAuthenticated) {
      setError('Você precisa estar autenticado para acessar esta funcionalidade.');
      setIsLoading(false);
      return;
    }

    if (user?.profile !== 'admin') {
      setError('Apenas administradores podem acessar esta funcionalidade.');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      // Verifica se há token
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Token de autenticação não encontrado. Faça login novamente.');
        setIsLoading(false);
        return;
      }

      const response = await externalDataAPI.listViews();
      if (response.data.success) {
        setViews(response.data.data || []);
        setError(''); // Limpa erro se sucesso
      } else {
        setError(response.data.message || 'Erro ao buscar views');
      }
    } catch (err: any) {
      console.error('Erro ao buscar views:', err);
      if (err.response?.status === 401) {
        setError('Não autorizado. Seu token pode ter expirado. Faça login novamente.');
      } else if (err.response?.status === 403) {
        setError('Acesso negado. Apenas administradores podem acessar esta funcionalidade.');
      } else {
        setError(err.response?.data?.message || err.message || 'Erro ao conectar com o banco de dados MySQL');
      }
      setViews([]);
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      setConnectionStatus('checking');
      setError(''); // Limpa erro anterior
      const response = await externalDataAPI.testConnection();
      if (response.data.success) {
        setConnectionStatus('connected');
        // Após testar conexão, busca as views
        await fetchViews();
      } else {
        setConnectionStatus('disconnected');
        setError('Falha na conexão MySQL');
      }
    } catch (err: any) {
      setConnectionStatus('disconnected');
      setError(err.response?.data?.message || 'Erro ao testar conexão');
    }
  };

  const fetchViewStructure = async (viewName: string) => {
    try {
      setIsLoadingStructure(true);
      setStructureError('');
      
      const response = await externalDataAPI.getViewStructure(viewName);
      
      if (response.data.success) {
        setViewStructure(response.data.data || []);
      } else {
        setStructureError(response.data.message || 'Erro ao buscar estrutura');
        setViewStructure([]);
      }
    } catch (err: any) {
      console.error('Erro ao buscar estrutura da view:', err);
      setStructureError(err.response?.data?.message || err.message || 'Erro ao buscar estrutura da view');
      setViewStructure([]);
    } finally {
      setIsLoadingStructure(false);
    }
  };

  const handleViewStructure = async (viewName: string) => {
    setSelectedView(viewName);
    setViewStructure([]);
    setStructureError('');
    await fetchViewStructure(viewName);
  };

  const handleCloseModal = () => {
    setSelectedView(null);
    setViewStructure([]);
    setStructureError('');
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-ngr-primary rounded-xl flex items-center justify-center">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Dados Externos</h1>
              <p className="text-sm text-slate-500">Views disponíveis no banco de dados MySQL</p>
            </div>
          </div>
          <button
            onClick={testConnection}
            disabled={connectionStatus === 'checking'}
            className="flex items-center gap-2 px-4 py-2 bg-ngr-primary text-white rounded-lg hover:bg-ngr-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {connectionStatus === 'checking' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>Testar Conexão</span>
          </button>
        </div>

        {/* Status da Conexão */}
        <div className="flex items-center gap-2 text-sm">
          {connectionStatus === 'checking' && (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="text-blue-600">Verificando conexão...</span>
            </>
          )}
          {connectionStatus === 'connected' && (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-green-600">Conectado ao MySQL</span>
            </>
          )}
          {connectionStatus === 'disconnected' && (
            <>
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-red-600">Desconectado</span>
            </>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Erro</p>
            <p className="text-sm text-red-600">{error}</p>
            {(error.includes('token') || error.includes('autorizado') || error.includes('Acesso negado')) && (
              <button
                onClick={() => {
                  window.location.reload();
                }}
                className="mt-2 text-sm text-red-700 underline hover:text-red-800"
              >
                Recarregar página
              </button>
            )}
          </div>
          <button
            onClick={() => setError('')}
            className="text-red-400 hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Views List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Views Disponíveis</h2>
            <span className="text-sm text-slate-500">
              {isLoading ? 'Carregando...' : `${views.length} view${views.length !== 1 ? 's' : ''} encontrada${views.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-ngr-primary mb-4" />
            <p className="text-slate-500">Carregando views...</p>
          </div>
        ) : views.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center">
            <Database className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-slate-500 mb-2">Nenhuma view encontrada</p>
            <p className="text-sm text-slate-400">Verifique a conexão com o banco de dados</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {views.map((view, index) => (
              <div
                key={index}
                className="p-4 hover:bg-slate-50 transition-colors flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Database className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate">{view.view_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">View do banco de dados</p>
                </div>
                <button
                  onClick={() => handleViewStructure(view.view_name)}
                  className="px-4 py-2 text-sm bg-ngr-primary text-white rounded-lg hover:bg-ngr-secondary transition-colors flex items-center gap-2"
                >
                  <Table2 className="w-4 h-4" />
                  Estrutura
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800 mb-1">Sobre as Views</p>
            <p className="text-sm text-blue-700">
              As views são tabelas virtuais que fornecem uma representação dos dados do banco de dados MySQL externo.
              Clique em "Estrutura" para visualizar a especificação (colunas, tipos, etc.) de uma view específica.
            </p>
          </div>
        </div>
      </div>

      {/* Modal de Estrutura da View */}
      {selectedView && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={handleCloseModal}>
          <div 
            className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{selectedView}</h2>
                <p className="text-sm text-slate-500 mt-1">Estrutura da view</p>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 transition-colors p-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo do Modal - Scrollable */}
            <div className="flex-1 overflow-auto p-6">
              {structureError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-800 mb-1">Erro ao buscar estrutura</p>
                      <p className="text-sm text-red-600">{structureError}</p>
                      <button
                        onClick={() => fetchViewStructure(selectedView)}
                        className="mt-3 px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        Tentar Novamente
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isLoadingStructure ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-ngr-primary mb-4" />
                  <p className="text-slate-500">Carregando estrutura...</p>
                </div>
              ) : viewStructure.length === 0 && !structureError ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Table2 className="w-12 h-12 text-slate-300 mb-4" />
                  <p className="text-slate-500">Nenhuma estrutura encontrada</p>
                </div>
              ) : viewStructure.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-lg">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider border-r border-slate-200">
                          Coluna
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider border-r border-slate-200">
                          Tipo de Dado
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider border-r border-slate-200">
                          Permite NULL
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider border-r border-slate-200">
                          Valor Padrão
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
                          Comentário
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {viewStructure.map((col, index) => (
                        <tr key={index} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm font-medium text-slate-800 border-r border-slate-100">
                            {col.column_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 border-r border-slate-100">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-mono">
                              {col.data_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 border-r border-slate-100">
                            <span className={`px-2 py-1 rounded text-xs ${
                              col.is_nullable === 'YES' 
                                ? 'bg-yellow-100 text-yellow-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {col.is_nullable === 'YES' ? 'Sim' : 'Não'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 border-r border-slate-100">
                            {col.column_default !== null ? (
                              <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded text-xs font-mono">
                                {col.column_default}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {col.column_comment || <span className="text-slate-400 italic">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

