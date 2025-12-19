import { useEffect, useMemo, useState, useRef } from 'react';
import { middlewareAPI, externalDataAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import {
  Database,
  RefreshCw,
  Plus,
  Trash2,
  Play,
  Save,
  Table2,
  Clock3,
  Activity,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';

type TransformationType =
  | 'trim'
  | 'lowercase'
  | 'uppercase'
  | 'toNumber'
  | 'toString'
  | 'toDate'
  | 'mapValue'
  | 'defaultValue';

type ScheduleMode = 'none' | 'cron' | 'preset';
type PresetType = 'daily' | 'weekly' | 'interval';

type ViewOption = { view_name: string };

interface MappingRow {
  sourceField: string;
  targetField: string;
  transforms: TransformationType[];
  defaultValue?: string;
  mapLines?: string; // texto para mapValue (from=to por linha)
  updateBehavior?: 'update' | 'keep'; // 'update' = sempre atualiza, 'keep' = sempre mantém
}

interface ExecutionError {
  type: 'validation' | 'duplicate' | 'required' | 'processing' | 'system';
  message: string;
  count: number;
  examples?: string[];
}

interface ExecutionLog {
  status: 'success' | 'partial' | 'error';
  startedAt: string | Date;
  finishedAt: string | Date;
  inserted: number;
  updated: number;
  failed: number;
  totalRecords?: number;
  message?: string;
  errors?: ExecutionError[];
}

interface DataSyncConfig {
  _id?: string;
  name: string;
  description?: string;
  active: boolean;
  sourceView: string;
  targetCollection: 'projects' | 'users' | 'teams';
  targetApi: string;
  sourceKeyField: string;
  targetKeyField: string;
  filterClause?: string;
  mappings: {
    sourceField: string;
    targetField: string;
    transformations?: {
      type: TransformationType;
      options?: any;
    }[];
    updateBehavior?: 'update' | 'keep'; // 'update' = sempre atualiza, 'keep' = sempre mantém
  }[];
  schedule: {
    mode: ScheduleMode;
    cronExpression?: string;
    preset?: {
      type: PresetType;
      intervalMinutes?: number;
      dayOfWeek?: number;
      timeOfDay?: string;
    };
  };
  history?: ExecutionLog[];
}

const defaultForm: DataSyncConfig = {
  name: '',
  description: '',
  active: true,
  sourceView: '',
  targetCollection: 'projects',
  targetApi: '/api/projects',
  sourceKeyField: '',
  targetKeyField: '',
  filterClause: '',
  mappings: [
    { sourceField: '', targetField: '', transformations: [] },
  ],
  schedule: { mode: 'none' },
  history: [],
};

export default function Middleware() {
  const { user } = useAuthStore();
  const [configs, setConfigs] = useState<DataSyncConfig[]>([]);
  const [views, setViews] = useState<ViewOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DataSyncConfig>(defaultForm);
  
  // Campos disponíveis
  const [sourceFields, setSourceFields] = useState<string[]>([]);
  const [loadingSourceFields, setLoadingSourceFields] = useState(false);
  
  // Campos de destino baseados nos modelos
  const targetFields = useMemo(() => {
    const fields: Record<string, string[]> = {
      projects: ['projectId', 'client', 'projectType', 'projectName', 'projectManager', 'active'],
      users: ['name', 'email', 'password', 'profile', 'functions', 'teams', 'hasAgenda', 'active', 'mustChangePassword'],
      teams: ['name', 'active'],
    };
    return fields[form.targetCollection] || [];
  }, [form.targetCollection]);

  const targetApiOptions = useMemo(() => ({
    projects: '/api/projects',
    users: '/api/users',
    teams: '/api/teams',
  }), []);

  const fetchViews = async () => {
    try {
      const res = await externalDataAPI.listViews();
      setViews(res.data.data || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchSourceFields = async (viewName: string) => {
    if (!viewName) {
      setSourceFields([]);
      return;
    }
    try {
      setLoadingSourceFields(true);
      const res = await externalDataAPI.getViewStructure(viewName);
      if (res.data.success && res.data.data) {
        const fields = res.data.data.map((col: any) => col.column_name);
        setSourceFields(fields);
      } else {
        setSourceFields([]);
      }
    } catch (err: any) {
      console.error('Erro ao buscar campos da view:', err);
      setSourceFields([]);
    } finally {
      setLoadingSourceFields(false);
    }
  };

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const res = await middlewareAPI.getConfigs();
      console.log('[Middleware] fetchConfigs - resposta recebida:', res.data.data?.length, 'configs');
      res.data.data?.forEach((config: any, index: number) => {
        console.log(`[Middleware] Config ${index + 1} (${config.name}):`, config.mappings?.length, 'mappings');
        console.log(`[Middleware] Mappings:`, JSON.stringify(config.mappings, null, 2));
      });
      setConfigs(res.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('[Middleware] Component mounted, fetching data...');
    fetchConfigs();
    fetchViews();
  }, []);

  const resetForm = () => {
    setForm({
      ...defaultForm,
      targetApi: targetApiOptions.projects,
    });
    setEditingId(null);
    setFormOpen(false);
    setSourceFields([]);
    setMappingsUI([{ sourceField: '', targetField: '', transforms: [], updateBehavior: 'update' }]);
    setError(''); // Limpar erro ao fechar/resetar
  };

  const handleEdit = (config: DataSyncConfig) => {
    console.log('[Middleware] handleEdit - config recebida:', config.name);
    console.log('[Middleware] handleEdit - mappings da config:', JSON.stringify(config.mappings, null, 2));
    console.log('[Middleware] handleEdit - número de mappings:', config.mappings?.length);
    
    // Converter mapeamentos para o formato do formulário auxiliar (mapLines)
    const mappings: MappingRow[] = (config.mappings || []).map((m) => {
      const transforms = (m.transformations || []).map((t) => t.type);
      const defaultValue = m.transformations?.find((t) => t.type === 'defaultValue')?.options?.defaultValue;
      const mapOpt = m.transformations?.find((t) => t.type === 'mapValue')?.options?.map;
      const mapLines = Array.isArray(mapOpt)
        ? mapOpt.map((p: any) => `${p.from}=${p.to}`).join('\n')
        : '';
      return {
        sourceField: m.sourceField,
        targetField: m.targetField,
        transforms,
        defaultValue,
        mapLines,
        updateBehavior: m.updateBehavior || 'update', // Padrão: sempre atualiza
      };
    });

    console.log('[Middleware] handleEdit - mappings convertidos:', JSON.stringify(mappings, null, 2));
    console.log('[Middleware] handleEdit - número de mappings convertidos:', mappings.length);

    setForm({
      ...config,
      mappings: config.mappings || [],
    });
    setEditingId(config._id || null);
    setFormOpen(true);

    // Guardar versões auxiliares no estado separado (mappingsUI)
    const mappingsUIToSet = mappings.length ? mappings : [{ sourceField: '', targetField: '', transforms: [], updateBehavior: 'update' }];
    console.log('[Middleware] handleEdit - setando mappingsUI com:', JSON.stringify(mappingsUIToSet, null, 2));
    setMappingsUI(mappingsUIToSet);
    
    // Buscar campos da view se já estiver selecionada
    if (config.sourceView) {
      fetchSourceFields(config.sourceView);
    }
  };

  const [mappingsUI, setMappingsUI] = useState<MappingRow[]>([
    { sourceField: '', targetField: '', transforms: [], updateBehavior: 'update' },
  ]);
  
  // Estado para controlar se os logs estão expandidos (por config)
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  
  // Ref para sempre ter a versão mais recente de mappingsUI
  const mappingsUIRef = useRef<MappingRow[]>(mappingsUI);
  
  // Atualizar ref sempre que mappingsUI mudar
  useEffect(() => {
    mappingsUIRef.current = mappingsUI;
    console.log('[Middleware] mappingsUI atualizado, ref sincronizado:', mappingsUI.length, 'mappings');
  }, [mappingsUI]);

  const addMappingRow = () => {
    setMappingsUI((prev) => {
      const newMappings = [...prev, { sourceField: '', targetField: '', transforms: [], updateBehavior: 'update' }];
      console.log('[Middleware] addMappingRow - novos mappings:', newMappings.length);
      return newMappings;
    });
  };

  const removeMappingRow = (index: number) => {
    setMappingsUI((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      const result = updated.length ? updated : [{ sourceField: '', targetField: '', transforms: [], updateBehavior: 'update' }];
      console.log('[Middleware] removeMappingRow - mappings após remoção:', result.length);
      return result;
    });
  };

  const updateMappingField = (index: number, field: keyof MappingRow, value: any) => {
    setMappingsUI((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      console.log(`[Middleware] updateMappingField - atualizando index ${index}, field ${field}:`, value);
      console.log('[Middleware] updateMappingField - mappings atualizados:', JSON.stringify(updated, null, 2));
      return updated;
    });
  };

  const toggleTransform = (index: number, type: TransformationType) => {
    const updated = [...mappingsUI];
    const current = new Set(updated[index].transforms);
    if (current.has(type)) {
      current.delete(type);
    } else {
      current.add(type);
    }
    updated[index].transforms = Array.from(current);
    setMappingsUI(updated);
  };

  const buildMappingsPayload = (mappingsArray: MappingRow[]): DataSyncConfig['mappings'] => {
    console.log('[Middleware] buildMappingsPayload - recebeu array com', mappingsArray.length, 'mappings');
    console.log('[Middleware] buildMappingsPayload - array:', JSON.stringify(mappingsArray, null, 2));
    
    return mappingsArray.map((m) => {
      const transformations: any[] = [];
      m.transforms.forEach((t) => {
        if (t === 'defaultValue' && m.defaultValue !== undefined) {
          transformations.push({ type: t, options: { defaultValue: m.defaultValue } });
        } else if (t === 'mapValue' && m.mapLines) {
          const map: any[] = m.mapLines
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
              const [from, to] = line.split('=');
              return { from: from?.trim(), to: to?.trim() };
            })
            .filter((p) => p.from !== undefined);
          transformations.push({ type: t, options: { map } });
        } else {
          transformations.push({ type: t });
        }
      });
      return {
        sourceField: m.sourceField,
        targetField: m.targetField,
        transformations,
        updateBehavior: m.updateBehavior || 'update', // Padrão: sempre atualiza
      };
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      
      // Validações
      if (!form.name?.trim()) {
        setError('Nome é obrigatório.');
        setSaving(false);
        return;
      }
      
      if (!form.sourceView) {
        setError('Selecione a view de origem.');
        setSaving(false);
        return;
      }
      
      if (!form.targetCollection) {
        setError('Selecione a tabela de destino.');
        setSaving(false);
        return;
      }
      
      if (!form.sourceKeyField) {
        setError('Selecione o campo chave na origem.');
        setSaving(false);
        return;
      }
      
      if (!form.targetKeyField) {
        setError('Selecione o campo chave no destino.');
        setSaving(false);
        return;
      }
      
      // Usar ref para garantir que pegamos o estado mais recente (evita closure)
      // Fallback para mappingsUI se ref ainda não foi inicializado
      const currentMappingsUI = mappingsUIRef.current || mappingsUI;
      console.log('[Middleware] 🔍 ESTADO ATUAL (via ref):', JSON.stringify(currentMappingsUI, null, 2));
      console.log('[Middleware] 🔍 NÚMERO de mappings no estado:', currentMappingsUI.length);
      
      console.log('[Middleware] mappingsUI antes de buildMappingsPayload:', JSON.stringify(currentMappingsUI, null, 2));
      const mappings = buildMappingsPayload(currentMappingsUI);
      console.log('[Middleware] mappings após buildMappingsPayload:', JSON.stringify(mappings, null, 2));
      const validMappings = mappings.filter(m => m.sourceField && m.targetField);
      console.log('[Middleware] validMappings após filtro:', JSON.stringify(validMappings, null, 2));
      console.log('[Middleware] Mappings filtrados (removidos por estarem vazios):', mappings.length - validMappings.length);
      
      if (validMappings.length === 0) {
        setError('Adicione pelo menos um mapeamento de campos.');
        setSaving(false);
        return;
      }

      // Garantir que o schedule está no formato correto
      const schedule = form.schedule || { mode: 'none' };
      
      // Limpar campos undefined para evitar problemas no Mongoose
      const payload: any = {
        name: form.name.trim(),
        active: form.active !== undefined ? form.active : true,
        sourceView: form.sourceView,
        targetCollection: form.targetCollection,
        targetApi: form.targetApi || targetApiOptions[form.targetCollection],
        sourceKeyField: form.sourceKeyField,
        targetKeyField: form.targetKeyField,
        mappings: validMappings,
        schedule: {
          mode: schedule.mode || 'none',
        },
      };
      
      // NÃO incluir history ao atualizar - será preservado no backend
      if (!editingId) {
        payload.history = []; // Apenas para novos registros
      }
      
      // Adicionar campos opcionais - sempre incluir, mesmo se vazios, para permitir limpar campos
      // Se não incluirmos campos vazios, o backend não vai atualizá-los
      payload.description = form.description?.trim() || '';
      payload.filterClause = form.filterClause?.trim() || '';
      
      // Para schedule, incluir apenas se tiver valor ou se estiver editando
      if (schedule.cronExpression?.trim()) {
        payload.schedule.cronExpression = schedule.cronExpression.trim();
      } else if (editingId && schedule.mode === 'cron') {
        // Se está editando e o modo é cron mas não tem expressão, limpar
        payload.schedule.cronExpression = '';
      }
      
      if (schedule.preset) {
        payload.schedule.preset = schedule.preset;
      }
      
      console.log('[Middleware] Sending payload:', JSON.stringify(payload, null, 2));
      console.log('[Middleware] Editing ID:', editingId);

      if (editingId) {
        console.log('[Middleware] Atualizando configuração:', editingId);
        await middlewareAPI.update(editingId, payload);
      } else {
        console.log('[Middleware] Criando nova configuração');
        await middlewareAPI.create(payload);
      }

      await fetchConfigs();
      setFormOpen(false);
      setSaving(false);
      resetForm();
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      setSaving(false);
      
      // Extrair mensagem de erro detalhada
      let errorMessage = 'Erro ao salvar configuração';
      let errorDetails: string[] = [];
      
      if (err.response?.data) {
        const data = err.response.data;
        
        // Mensagem principal
        if (data.error) {
          errorMessage = typeof data.error === 'string' ? data.error : 'Erro de validação';
        } else if (data.message) {
          errorMessage = data.message;
        }
        
        // Adicionar detalhes de validação
        if (data.validationErrors) {
          errorDetails.push(`Validação: ${data.validationErrors}`);
        }
        
        // Adicionar erros por campo
        if (data.fieldErrors) {
          const fieldErrors = Object.keys(data.fieldErrors)
            .map(key => `  • ${key}: ${data.fieldErrors[key]}`)
            .join('\n');
          if (fieldErrors) {
            errorDetails.push('Erros por campo:\n' + fieldErrors);
          }
        }
        
        // Adicionar outros detalhes
        if (data.details && typeof data.details === 'string') {
          errorDetails.push(data.details);
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      // Montar mensagem final
      let finalMessage = errorMessage;
      if (errorDetails.length > 0) {
        finalMessage += '\n\n' + errorDetails.join('\n\n');
      }
      
      // Adicionar informações de debug em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        finalMessage += `\n\n[Debug] Status: ${err.response?.status || 'N/A'}`;
        if (err.response?.data) {
          finalMessage += `\n[Debug] Response: ${JSON.stringify(err.response.data, null, 2)}`;
        }
      }
      
      setError(finalMessage);
    }
  };

  const handleExecute = async (id: string) => {
    try {
      setExecutingId(id);
      await middlewareAPI.execute(id);
      await fetchConfigs();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao executar carga');
    } finally {
      setExecutingId(null);
    }
  };

  const HistoryItem = ({ entry, index }: { entry: ExecutionLog; index: number }) => {
    const [expanded, setExpanded] = useState(false);
    const duration = new Date(entry.finishedAt).getTime() - new Date(entry.startedAt).getTime();
    const durationSeconds = (duration / 1000).toFixed(1);

    const getStatusLabel = (status: string) => {
      switch (status) {
        case 'success': return 'Sucesso';
        case 'partial': return 'Parcial';
        case 'error': return 'Erro';
        default: return status;
      }
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'success': return 'bg-green-100 text-green-700';
        case 'partial': return 'bg-yellow-100 text-yellow-700';
        case 'error': return 'bg-red-100 text-red-700';
        default: return 'bg-slate-100 text-slate-700';
      }
    };

    const getErrorTypeLabel = (type: string) => {
      switch (type) {
        case 'validation': return '🔍 Validação';
        case 'duplicate': return '🔄 Duplicata';
        case 'required': return '⚠️ Campo Obrigatório';
        case 'processing': return '⚙️ Processamento';
        case 'system': return '❌ Sistema';
        default: return type;
      }
    };

    const getErrorTypeColor = (type: string) => {
      switch (type) {
        case 'validation': return 'bg-yellow-200 text-yellow-800';
        case 'duplicate': return 'bg-orange-200 text-orange-800';
        case 'required': return 'bg-red-200 text-red-800';
        case 'processing': return 'bg-blue-200 text-blue-800';
        case 'system': return 'bg-red-200 text-red-800';
        default: return 'bg-slate-200 text-slate-800';
      }
    };

    return (
      <div className="border border-slate-200 rounded-lg p-3 bg-white">
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(entry.status)}`}>
            {getStatusLabel(entry.status)}
          </span>
          <span className="text-xs text-slate-600">
            {new Date(entry.startedAt).toLocaleString('pt-BR')}
          </span>
          <span className="text-xs text-slate-500">
            ({durationSeconds}s)
          </span>
          <span className="text-xs text-slate-600">
            Total: <span className="font-semibold">{entry.totalRecords || (entry.inserted + entry.updated + entry.failed)}</span> |
            <span className={entry.inserted > 0 ? 'text-green-600 font-semibold' : ''}> Inseridos: {entry.inserted}</span> |
            <span className={entry.updated > 0 ? 'text-blue-600 font-semibold' : ''}> Atualizados: {entry.updated}</span> |
            <span className={entry.failed > 0 ? 'text-red-600 font-semibold' : ''}>
              {' '}Falhas: {entry.failed}
            </span>
          </span>
        </div>

        {/* Mensagem principal */}
        {entry.message && (
          <div className={`text-sm mb-2 ${
            entry.status === 'error' ? 'text-red-700 font-medium' :
            entry.status === 'partial' ? 'text-yellow-700' :
            'text-green-700'
          }`}>
            {entry.message}
          </div>
        )}

        {/* Erros detalhados */}
        {entry.errors && entry.errors.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm font-medium text-red-700 hover:text-red-900 flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100 transition-colors w-full"
            >
              <AlertCircle className="w-4 h-4" />
              {expanded ? '▼ Ocultar' : '▶ Ver'} detalhes dos erros
              <span className="ml-auto px-2 py-0.5 bg-red-200 text-red-800 rounded-full text-xs font-semibold">
                {entry.errors.length} tipo{entry.errors.length > 1 ? 's' : ''} • {entry.failed} falha{entry.failed > 1 ? 's' : ''}
              </span>
            </button>

            {expanded && (
              <div className="mt-3 space-y-3 pl-4 border-l-3 border-red-400">
                {entry.errors.map((error, errIdx) => (
                  <div key={errIdx} className="bg-red-50 rounded-lg p-3 border border-red-200">
                    {/* Cabeçalho do erro */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getErrorTypeColor(error.type)}`}>
                            {getErrorTypeLabel(error.type)}
                          </span>
                          <span className="text-xs font-semibold text-red-800">
                            {error.count} ocorrência{error.count > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-red-900 mt-1 break-words">
                          {error.message}
                        </div>
                      </div>
                    </div>

                    {/* Exemplos */}
                    {error.examples && error.examples.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-red-200">
                        <div className="text-xs font-semibold text-red-700 mb-2">
                          Exemplos de registros com erro:
                        </div>
                        <div className="space-y-2">
                          {error.examples.map((ex, exIdx) => (
                            <div key={exIdx} className="bg-white rounded p-2 text-xs font-mono text-slate-700 break-all border border-red-100">
                              <div className="text-slate-500 text-[10px] mb-1">Exemplo #{exIdx + 1}:</div>
                              <div className="whitespace-pre-wrap">{ex}</div>
                            </div>
                          ))}
                        </div>
                        {error.count > error.examples.length && (
                          <div className="mt-2 text-xs text-slate-600 italic">
                            ... e mais {error.count - error.examples.length} ocorrência{error.count - error.examples.length > 1 ? 's' : ''} similar{error.count - error.examples.length > 1 ? 'es' : ''}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Resumo */}
                <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-xs font-semibold text-slate-700 mb-1">📊 Resumo da execução:</div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div>Total de registros processados: <span className="font-semibold">{entry.totalRecords || (entry.inserted + entry.updated + entry.failed)}</span></div>
                    <div className="flex gap-4">
                      <span className={entry.inserted > 0 ? 'text-green-700 font-semibold' : ''}>
                        ✅ Inseridos: {entry.inserted}
                      </span>
                      <span className={entry.updated > 0 ? 'text-blue-700 font-semibold' : ''}>
                        🔄 Atualizados: {entry.updated}
                      </span>
                      <span className={entry.failed > 0 ? 'text-red-700 font-semibold' : ''}>
                        ❌ Falhas: {entry.failed}
                      </span>
                    </div>
                    {entry.failed > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-300 text-red-700">
                        <span className="font-semibold">Taxa de falha:</span> {((entry.failed / (entry.totalRecords || (entry.inserted + entry.updated + entry.failed))) * 100).toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderHistory = (history?: ExecutionLog[]) => {
    if (!history || history.length === 0) return <p className="text-sm text-slate-500">Sem execuções.</p>;
    return (
      <div className="space-y-3">
        {history.slice(0, 5).map((h, idx) => (
          <HistoryItem key={idx} entry={h} index={idx} />
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-ngr-primary rounded-xl flex items-center justify-center">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Interfaces</h1>
            <p className="text-sm text-slate-500">Configurações de Interfaces</p>
          </div>
        </div>
        <button
          onClick={() => {
            setError(''); // Limpar erro ao abrir novo formulário
            resetForm();
            setFormOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-ngr-primary text-white rounded-lg hover:bg-ngr-secondary transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Interface
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-800 mb-2">Erro ao processar</p>
              <div className="text-sm text-red-700 whitespace-pre-wrap break-words">
                {error.split('\n').map((line, idx) => (
                  <div key={idx} className={idx > 0 ? 'mt-1' : ''}>
                    {line}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setError('')}
                className="mt-3 text-xs text-red-600 hover:text-red-800 underline"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-700">
            <Database className="w-5 h-5" />
            <span className="font-semibold">Configurações</span>
          </div>
          <button
            onClick={fetchConfigs}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-ngr-primary"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center gap-3 text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            Carregando...
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {configs.length === 0 && (
              <div className="p-6 text-slate-500 text-sm">Nenhuma configuração criada.</div>
            )}
            {configs.map((config) => (
              <div key={config._id} className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-slate-800">{config.name}</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        config.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {config.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    {config.description && (
                      <p className="text-sm text-slate-600">
                        {config.description}
                      </p>
                    )}
                    <p className="text-sm text-slate-600">
                      Origem: {config.sourceView} • Destino: {config.targetCollection} ({config.targetApi})
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(config)}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleExecute(config._id!)}
                      disabled={executingId === config._id}
                      className="px-3 py-2 text-sm bg-ngr-primary text-white rounded-lg hover:bg-ngr-secondary transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {executingId === config._id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Executar agora
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <div className="flex items-center gap-1">
                    <Clock3 className="w-4 h-4" />
                    <span>
                      Agenda: {config.schedule?.mode === 'none' ? 'Sem agendamento' :
                        config.schedule?.mode === 'cron' ? `Cron: ${config.schedule?.cronExpression}` :
                        config.schedule?.preset?.type === 'daily' ? 'Diária' :
                        config.schedule?.preset?.type === 'weekly' ? 'Semanal' :
                        `Intervalo ${config.schedule?.preset?.intervalMinutes || 15} min`}
                    </span>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <button
                    onClick={() => setExpandedLogs(prev => ({ ...prev, [config._id || '']: !prev[config._id || ''] }))}
                    className="w-full flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
                  >
                    <span className="text-slate-500">
                      {expandedLogs[config._id || ''] ? '▼' : '▶'}
                    </span>
                    <span>Últimas execuções</span>
                  </button>
                  {expandedLogs[config._id || ''] && (
                    <div className="mt-2">
                      {renderHistory(config.history)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de criação/edição */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={resetForm}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {editingId ? 'Editar configuração' : 'Nova configuração'}
                </h2>
                <p className="text-sm text-slate-500">Defina origem, destino, mapeamento e agendamento.</p>
              </div>
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Exibição de erro dentro do modal */}
            {error && (
              <div className="mx-5 mt-5 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-800 mb-2">Erro ao salvar</p>
                    <div className="text-sm text-red-700 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                      {error.split('\n').map((line, idx) => (
                        <div key={idx} className={idx > 0 ? 'mt-1' : ''}>
                          {line}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setError('')}
                      className="mt-3 text-xs text-red-600 hover:text-red-800 underline"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-auto p-5 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Nome *</label>
                  <input
                    className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Descrição</label>
                  <input
                    className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={form.description || ''}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">View de origem *</label>
                  <select
                    className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={form.sourceView}
                    onChange={(e) => {
                      const viewName = e.target.value;
                      setForm({ ...form, sourceView: viewName, sourceKeyField: '' });
                      fetchSourceFields(viewName);
                    }}
                  >
                    <option value="">Selecione...</option>
                    {views.map((v) => (
                      <option key={v.view_name} value={v.view_name}>{v.view_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Destino *</label>
                  <select
                    className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={form.targetCollection}
                    onChange={(e) => {
                      const tc = e.target.value as DataSyncConfig['targetCollection'];
                      const newFields = {
                        projects: ['projectId', 'client', 'projectType', 'projectName', 'projectManager', 'active'],
                        users: ['name', 'email', 'password', 'profile', 'functions', 'teams', 'hasAgenda', 'active', 'mustChangePassword'],
                        teams: ['name', 'active'],
                      }[tc] || [];
                      setForm({
                        ...form,
                        targetCollection: tc,
                        targetApi: targetApiOptions[tc],
                        targetKeyField: newFields.includes(form.targetKeyField) ? form.targetKeyField : '',
                      });
                    }}
                  >
                    <option value="projects">Projects</option>
                    <option value="users">Users</option>
                    <option value="teams">Teams</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">API de destino *</label>
                  <input
                    className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={form.targetApi}
                    onChange={(e) => setForm({ ...form, targetApi: e.target.value })}
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Usaremos POST/PUT para upsert via API.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Campo chave na origem *</label>
                  <select
                    className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={form.sourceKeyField}
                    onChange={(e) => setForm({ ...form, sourceKeyField: e.target.value })}
                    disabled={!form.sourceView || loadingSourceFields}
                  >
                    <option value="">{loadingSourceFields ? 'Carregando...' : 'Selecione o campo'}</option>
                    {sourceFields.map((field) => (
                      <option key={field} value={field}>{field}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Campo chave no destino *</label>
                  <select
                    className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={form.targetKeyField}
                    onChange={(e) => setForm({ ...form, targetKeyField: e.target.value })}
                    disabled={!form.targetCollection}
                  >
                    <option value="">Selecione o campo</option>
                    {targetFields.map((field) => (
                      <option key={field} value={field}>{field}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Filtro SQL (cláusula WHERE)</label>
                <input
                  className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Ex.: status = 'ativo' AND tipo = 'X'"
                  value={form.filterClause || ''}
                  onChange={(e) => setForm({ ...form, filterClause: e.target.value })}
                />
                <p className="text-[11px] text-slate-500 mt-1">Apenas WHERE. Comandos perigosos são bloqueados.</p>
              </div>

              {/* Mapeamentos */}
              <div className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-700">Mapeamento de campos</p>
                  <button
                    onClick={addMappingRow}
                    className="flex items-center gap-1 text-sm text-ngr-primary"
                    type="button"
                  >
                    <Plus className="w-4 h-4" /> Adicionar
                  </button>
                </div>
                <div className="space-y-3">
                  {mappingsUI.map((m, idx) => (
                    <div key={idx} className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs font-medium text-slate-700">Campo origem</label>
                          <select
                            className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            value={m.sourceField}
                            onChange={(e) => updateMappingField(idx, 'sourceField', e.target.value)}
                            disabled={!form.sourceView || loadingSourceFields}
                          >
                            <option value="">{loadingSourceFields ? 'Carregando...' : 'Selecione o campo'}</option>
                            {sourceFields.map((field) => (
                              <option key={field} value={field}>{field}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-700">Campo destino</label>
                          <select
                            className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            value={m.targetField}
                            onChange={(e) => updateMappingField(idx, 'targetField', e.target.value)}
                            disabled={!form.targetCollection}
                          >
                            <option value="">Selecione o campo</option>
                            {targetFields.map((field) => (
                              <option key={field} value={field}>{field}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-700">Se registro existir</label>
                          <select
                            className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            value={m.updateBehavior || 'update'}
                            onChange={(e) => updateMappingField(idx, 'updateBehavior', e.target.value as 'update' | 'keep')}
                          >
                            <option value="update">Atualiza</option>
                            <option value="keep">Mantém</option>
                          </select>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {m.updateBehavior === 'keep' ? 'Preserva valor existente' : 'Sobrescreve valor existente'}
                          </p>
                        </div>
                        <div className="flex items-end justify-end">
                          <button
                            onClick={() => removeMappingRow(idx)}
                            className="text-red-500 hover:text-red-600 text-sm flex items-center gap-1"
                            type="button"
                          >
                            <Trash2 className="w-4 h-4" /> Remover
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-slate-700">Transformações</p>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {(['trim','lowercase','uppercase','toNumber','toString','toDate'] as TransformationType[]).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => toggleTransform(idx, t)}
                                className={`px-2 py-1 rounded border text-[11px] ${
                                  m.transforms.includes(t)
                                    ? 'bg-ngr-primary text-white border-ngr-primary'
                                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-700">Valor padrão (defaultValue)</label>
                          <input
                            className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            value={m.defaultValue || ''}
                            onChange={(e) => {
                              updateMappingField(idx, 'defaultValue', e.target.value);
                              if (e.target.value && !m.transforms.includes('defaultValue')) {
                                toggleTransform(idx, 'defaultValue');
                              }
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-700">Mapeamento de valores (from=to, um por linha)</label>
                          <textarea
                            className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            rows={3}
                            value={m.mapLines || ''}
                            onChange={(e) => {
                              updateMappingField(idx, 'mapLines', e.target.value);
                              if (e.target.value && !m.transforms.includes('mapValue')) {
                                toggleTransform(idx, 'mapValue');
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Agendamento */}
              <div className="border border-slate-200 rounded-lg p-3 space-y-3">
                <p className="text-sm font-semibold text-slate-700">Agendamento</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700">Modo</label>
                    <select
                      className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={form.schedule?.mode || 'none'}
                      onChange={(e) => setForm({
                        ...form,
                        schedule: { ...form.schedule, mode: e.target.value as ScheduleMode },
                      })}
                    >
                      <option value="none">Sem agendamento</option>
                      <option value="cron">Cron</option>
                      <option value="preset">Preset</option>
                    </select>
                  </div>
                  {form.schedule?.mode === 'cron' && (
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-slate-700">Expressão cron</label>
                      <input
                        className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Ex.: 0 2 * * * (todos os dias às 02:00)"
                        value={form.schedule?.cronExpression || ''}
                        onChange={(e) => setForm({
                          ...form,
                          schedule: { ...form.schedule, cronExpression: e.target.value },
                        })}
                      />
                    </div>
                  )}
                  {form.schedule?.mode === 'preset' && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-slate-700">Tipo</label>
                        <select
                          className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          value={form.schedule?.preset?.type || 'daily'}
                          onChange={(e) => setForm({
                            ...form,
                            schedule: {
                              ...form.schedule,
                              preset: { ...(form.schedule?.preset || {}), type: e.target.value as PresetType },
                            },
                          })}
                        >
                          <option value="daily">Diária</option>
                          <option value="weekly">Semanal</option>
                          <option value="interval">A cada X minutos</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-700">Horário (HH:mm)</label>
                        <input
                          className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          placeholder="02:00"
                          value={form.schedule?.preset?.timeOfDay || ''}
                          onChange={(e) => setForm({
                            ...form,
                            schedule: {
                              ...form.schedule,
                              preset: { ...(form.schedule?.preset || {}), timeOfDay: e.target.value },
                            },
                          })}
                        />
                      </div>
                      {form.schedule?.preset?.type === 'weekly' && (
                        <div>
                          <label className="text-xs font-medium text-slate-700">Dia da semana (0=Dom)</label>
                          <input
                            type="number"
                            min={0}
                            max={6}
                            className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            value={form.schedule?.preset?.dayOfWeek ?? 0}
                            onChange={(e) => setForm({
                              ...form,
                              schedule: {
                                ...form.schedule,
                                preset: { ...(form.schedule?.preset || {}), dayOfWeek: Number(e.target.value) },
                              },
                            })}
                          />
                        </div>
                      )}
                      {form.schedule?.preset?.type === 'interval' && (
                        <div>
                          <label className="text-xs font-medium text-slate-700">Intervalo (minutos)</label>
                          <input
                            type="number"
                            min={1}
                            max={60}
                            className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            value={form.schedule?.preset?.intervalMinutes ?? 15}
                            onChange={(e) => setForm({
                              ...form,
                              schedule: {
                                ...form.schedule,
                                preset: { ...(form.schedule?.preset || {}), intervalMinutes: Number(e.target.value) },
                              },
                            })}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-ngr-primary text-white rounded-lg hover:bg-ngr-secondary transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

