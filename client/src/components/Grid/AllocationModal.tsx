import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  X, Trash2, Save, Calendar, Clock, Building2, User as UserIcon, 
  AlertTriangle, FileText, Paperclip, History, Upload, Download, File, Plus, Check, ExternalLink
} from 'lucide-react';
import { useAgendaStore } from '../../store/agendaStore';
import { usePermissions } from '../../hooks/usePermissions';
import { allocationsAPI } from '../../services/api';
import { 
  User, 
  Allocation, 
  Project,
  Period, 
  TimeSlot,
  STATUS_LABELS,
  PERIOD_LABELS,
  TIME_SLOTS_BY_PERIOD,
  TIME_SLOT_LABELS,
  StatusConfig,
  AllocationHistory,
  AllocationAttachment,
} from '../../types';

interface Props {
  consultant: User;
  date: Date;
  timeSlot?: TimeSlot;
  period?: Period;
  allocation?: Allocation;
  existingAllocations?: Allocation[];
  isAdmin?: boolean; // Se false, modal será somente leitura
  onClose: () => void;
}

export default function AllocationModal({
  consultant,
  date,
  timeSlot: initialTimeSlot,
  period: initialPeriod,
  allocation,
  existingAllocations = [],
  isAdmin = true, // Padrão: admin (compatibilidade)
  onClose
}: Props) {
  const { projects, createAllocation, updateAllocation, deleteAllocation, statusConfigs, refreshData } = useAgendaStore();
  const { hasPermission } = usePermissions();
  
  // Determinar se pode editar baseado em permissões
  // Se isAdmin foi passado como prop, usar ele (compatibilidade)
  // Caso contrário, verificar permissões
  const effectiveIsAdmin = isAdmin !== undefined 
    ? isAdmin 
    : hasPermission('allocations.create') || hasPermission('allocations.update');
  
  // Estado para filtro de gerente
  const [selectedManagerFilter, setSelectedManagerFilter] = useState<string>('');
  
  // Obter lista única de gerentes dos projetos ativos
  const uniqueManagers = useMemo(() => {
    const managers = projects
      .filter(p => p.active && p.projectManager)
      .map(p => p.projectManager!)
      .filter((manager, index, self) => self.indexOf(manager) === index)
      .sort();
    return managers;
  }, [projects]);
  
  // Filtrar projetos baseado no gerente selecionado
  const filteredProjects = useMemo(() => {
    if (!selectedManagerFilter) {
      return projects.filter(p => p.active);
    }
    return projects.filter(p => p.active && p.projectManager === selectedManagerFilter);
  }, [projects, selectedManagerFilter]);

  const [activeTab, setActiveTab] = useState<'form' | 'history' | 'attachments'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [history, setHistory] = useState<AllocationHistory[]>([]);
  const [attachments, setAttachments] = useState<AllocationAttachment[]>([]);
  
  // Estado para controlar seleção quando há conflito
  const [selectedAllocation, setSelectedAllocation] = useState<Allocation | null>(allocation || null);
  const [showSelector, setShowSelector] = useState(existingAllocations.length > 1 && !allocation);
  const [isCreatingNew, setIsCreatingNew] = useState(false); // Controla se está criando nova alocação
  const hasConflict = existingAllocations.length > 1;
  
  // Alocação efetiva para o formulário (deve vir cedo para ser usada nos useEffects)
  // Se isCreatingNew for true, ignora a alocação existente
  const effectiveAllocation = isCreatingNew ? null : (selectedAllocation || allocation);

  // Cria um mapa de labels dos status cadastrados
  const statusLabelsFromConfig = useMemo(() => {
    const map: Record<string, string> = { ...STATUS_LABELS };
    if (Array.isArray(statusConfigs)) {
      statusConfigs.forEach((config: StatusConfig) => {
        if (config.active) {
          map[config.key] = config.label;
        }
      });
    }
    return map;
  }, [statusConfigs]);

  // Lista de status disponíveis para seleção
  const availableStatuses = useMemo(() => {
    if (Array.isArray(statusConfigs) && statusConfigs.length > 0) {
      return statusConfigs
        .filter((config: StatusConfig) => config.active && config.key !== 'conflito' && config.key !== 'fim_semana')
        .sort((a: StatusConfig, b: StatusConfig) => a.order - b.order)
        .map((config: StatusConfig) => ({ 
          key: config.key, 
          label: config.label,
          requiresProject: config.requiresProject ?? true 
        }));
    }
    return Object.entries(STATUS_LABELS)
      .filter(([key]) => key !== 'conflito' && key !== 'fim_semana')
      .map(([key, label]) => ({ key, label, requiresProject: !['livre', 'bloqueado', 'feriado', 'ponte'].includes(key) }));
  }, [statusConfigs]);

  // Inicializar horários automaticamente com base no período inicial
  // Quando não há alocação existente (nova alocação), sempre usar TODOS os horários do período
  const getInitialTimeSlots = (): TimeSlot[] => {
    const period = initialPeriod || 'manha';
    // Sempre retornar todos os horários do período, não apenas o timeSlot inicial
    return TIME_SLOTS_BY_PERIOD[period] || ['08-10'];
  };

  // Para nova alocação: sempre usar todos os horários do período inicial
  // Para edição: será sobrescrito no useEffect quando allocation existir
  const initialTimeSlots = !allocation 
    ? getInitialTimeSlots() // Nova alocação: todos os horários do período
    : (initialTimeSlot ? [initialTimeSlot] : getInitialTimeSlots()); // Edição: horário específico ou todos

  const [formData, setFormData] = useState({
    projectId: '',
    periods: [initialPeriod || 'manha'] as Period[], // Array de períodos
    timeSlots: initialTimeSlots, // Array de horários
    status: 'a_confirmar',
    artiaActivity: '',
    notes: ''
  });

  // Verifica se o status atual requer projeto (deve vir DEPOIS de formData)
  const currentStatusRequiresProject = useMemo(() => {
    const status = availableStatuses.find(s => s.key === formData.status);
    return status?.requiresProject ?? true;
  }, [availableStatuses, formData.status]);

  const willCreateConflict = !allocation && existingAllocations.length > 0;
  const effectiveStatus = willCreateConflict ? 'conflito' : formData.status;

  // Quando há alocação existente (edição), carregar dados da alocação
  useEffect(() => {
    if (allocation) {
      const project = allocation.projectId as Project;
      const fullProject = project && typeof project === 'object' 
        ? projects.find(p => (p._id || p.id) === (project._id || project.id))
        : null;
      
      setFormData({
        projectId: project?._id || project?.id || '',
        periods: [allocation.period], // Array com período da alocação
        timeSlots: [allocation.timeSlot], // Array com horário da alocação (edição usa apenas o horário existente)
        status: allocation.status,
        artiaActivity: allocation.artiaActivity || '',
        notes: allocation.notes || ''
      });
      
      // Definir o gerente do projeto selecionado
      if (fullProject?.projectManager) {
        setSelectedManagerFilter(fullProject.projectManager);
      } else {
        setSelectedManagerFilter('');
      }
      
      setHistory(allocation.history || []);
      setAttachments(allocation.attachments || []);
    } else {
      // Quando não há alocação (nova alocação), garantir que todos os horários do período inicial estão selecionados
      if (initialPeriod) {
        const periodTimeSlots = TIME_SLOTS_BY_PERIOD[initialPeriod] || [];
        setFormData(prev => ({
          ...prev,
          periods: [initialPeriod],
          timeSlots: periodTimeSlots.length > 0 ? periodTimeSlots : prev.timeSlots
        }));
      }
    }
  }, [allocation, projects, initialPeriod]);

  // Carregar histórico e anexos completos
  useEffect(() => {
    if (effectiveAllocation && (activeTab === 'history' || activeTab === 'attachments')) {
      loadAllocationDetails();
    }
  }, [effectiveAllocation, activeTab]);

  const loadAllocationDetails = async (allocId?: string) => {
    const id = allocId || effectiveAllocation?._id || effectiveAllocation?.id;
    if (!id) return;
    try {
      const response = await allocationsAPI.getById(id);
      const data = response.data.allocation;
      setHistory(data.history || []);
      setAttachments(data.attachments || []);
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
    }
  };

  // Helper para formatar data sem problemas de timezone
  // IMPORTANTE: Sempre usa os métodos getFullYear(), getMonth(), getDate() 
  // que retornam valores no timezone LOCAL, evitando problemas de conversão
  // Este método garante que a string resultante sempre será "yyyy-MM-dd" correto
  const formatDateSafe = (date: Date): string => {
    // IMPORTANTE: Não usar format() do date-fns aqui, pois pode ter problemas de timezone
    // Usar diretamente os métodos nativos do Date que sempre retornam valores no timezone local
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() retorna 0-11, então +1 para 1-12
    const day = date.getDate(); // getDate() retorna o dia do mês no timezone local (1-31)
    
    // Formatar como "yyyy-MM-dd"
    const yearStr = String(year);
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    
    return `${yearStr}-${monthStr}-${dayStr}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Bloquear submissão se não for admin
    if (!effectiveIsAdmin) {
      console.warn('Tentativa de salvar alocação por usuário não-admin bloqueada');
      return;
    }

    // VALIDAÇÃO: Verificar se o status requer projeto e se projeto foi selecionado
    if (currentStatusRequiresProject && !formData.projectId) {
      alert('Este status requer que um projeto seja selecionado. Por favor, selecione um projeto antes de salvar.');
      return;
    }
    
    setIsSubmitting(true);

    try {
      // Formatar data de forma segura (sem problemas de timezone)
      // IMPORTANTE: A prop 'date' já deve estar normalizada pelo AgendaGrid
      // Mas garantimos que formatamos corretamente para string "yyyy-MM-dd"
      const formattedDate = formatDateSafe(date);
      
      // Se está editando uma alocação existente, usa a lógica antiga (um único período/horário)
      if (effectiveAllocation) {
        const data = {
          consultantId: consultant.id || consultant._id,
          projectId: formData.projectId || undefined,
          date: formattedDate, // String "yyyy-MM-dd"
          period: formData.periods[0], // Pega o primeiro período
          timeSlot: formData.timeSlots[0], // Pega o primeiro horário
          status: effectiveStatus,
          artiaActivity: formData.artiaActivity || undefined,
          notes: formData.notes || undefined
        };
        // Usar optimistic = false para garantir refresh completo após salvar no modal
        // Isso garante que todas as mudanças complexas sejam sincronizadas corretamente
        await updateAllocation(effectiveAllocation._id || effectiveAllocation.id, data, false);
      } else {
        // Criando novas alocações: cria uma para cada combinação de período + horário
        const allocations = [];
        
        for (const period of formData.periods) {
          // Filtrar apenas os horários que pertencem a este período
          const periodTimeSlots = formData.timeSlots.filter(ts => 
            TIME_SLOTS_BY_PERIOD[period].includes(ts)
          );
          
          for (const timeSlot of periodTimeSlots) {
            allocations.push({
              consultantId: consultant.id || consultant._id,
              projectId: formData.projectId || undefined,
              date: formattedDate, // String "yyyy-MM-dd"
              period,
              timeSlot,
              status: effectiveStatus,
              artiaActivity: formData.artiaActivity || undefined,
              notes: formData.notes || undefined
            });
          }
        }
        
        // Criar todas as alocações
        for (const allocationData of allocations) {
          await createAllocation(allocationData);
        }
      }
      
      setIsCreatingNew(false); // Reset ao fechar
      handleClose();
    } catch (error) {
      console.error('Error saving allocation:', error);
      alert('Erro ao salvar alocação. Por favor, tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleNew = () => {
    // Limpa o formulário para criar nova alocação, mantendo período e horário
    setIsCreatingNew(true);
    setSelectedAllocation(null);
    setFormData({
      projectId: '',
      periods: formData.periods, // Mantém os períodos atuais
      timeSlots: formData.timeSlots, // Mantém os horários atuais
      status: 'a_confirmar',
      artiaActivity: '',
      notes: ''
    });
    setHistory([]);
    setAttachments([]);
    setActiveTab('form'); // Volta para a aba de formulário
  };

  const handleClose = () => {
    setIsCreatingNew(false); // Reset ao fechar
    setSelectedManagerFilter(''); // Limpar filtro de gerente ao fechar
    onClose();
  };

  const handleDelete = async () => {
    if (!effectiveIsAdmin) {
      console.warn('Tentativa de remover alocação por usuário não-admin bloqueada');
      return;
    }
    if (!effectiveAllocation || !confirm('Tem certeza que deseja remover esta alocação?')) return;
    
    setIsSubmitting(true);
    try {
      await deleteAllocation(effectiveAllocation._id || effectiveAllocation.id);
      setIsCreatingNew(false); // Reset ao fechar
      handleClose();
    } catch (error) {
      console.error('Error deleting allocation:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!allocation || !e.target.files || e.target.files.length === 0) return;

    setIsUploading(true);
    try {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('file', file);

      await allocationsAPI.addAttachment(effectiveAllocation!._id || effectiveAllocation!.id, formData);
      await loadAllocationDetails();
      await refreshData();
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      alert('Erro ao fazer upload do arquivo');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    if (!allocation || !confirm('Tem certeza que deseja remover este anexo?')) return;

    try {
      await allocationsAPI.removeAttachment(effectiveAllocation!._id || effectiveAllocation!.id, attachmentId);
      await loadAllocationDetails();
    } catch (error) {
      console.error('Erro ao remover anexo:', error);
    }
  };

  // Horários disponíveis para todos os períodos selecionados
  const availableTimeSlots = formData.periods.flatMap(period => TIME_SLOTS_BY_PERIOD[period]);

  // Atualizar horários quando os períodos mudam (remover apenas horários inválidos)
  // Nota: Não adicionamos horários automaticamente aqui para não sobrescrever a seleção manual do usuário
  // A adição automática acontece apenas em togglePeriod quando um período é selecionado
  useEffect(() => {
    if (formData.periods.length > 0) {
      const allTimeSlots = formData.periods.flatMap(period => TIME_SLOTS_BY_PERIOD[period]);
      // Manter apenas os horários que ainda são válidos para os períodos selecionados
      setFormData(prev => {
        const validTimeSlots = prev.timeSlots.filter(ts => allTimeSlots.includes(ts));
        // Se não há horários válidos, adicionar todos os horários dos períodos selecionados
        if (validTimeSlots.length === 0 && prev.timeSlots.length > 0) {
          return {
            ...prev,
            timeSlots: allTimeSlots
          };
        }
        return {
          ...prev,
          timeSlots: validTimeSlots
        };
      });
    }
  }, [formData.periods]);

  const togglePeriod = (period: Period) => {
    setFormData(prev => {
      const isSelected = prev.periods.includes(period);
      const newPeriods = isSelected
        ? prev.periods.filter(p => p !== period)
        : [...prev.periods, period];
      
      // Se não sobrou nenhum período, retorna sem fazer nada
      if (newPeriods.length === 0) return prev;
      
      // Obter os horários do período sendo selecionado/deselecionado
      const periodTimeSlots = TIME_SLOTS_BY_PERIOD[period];
      
      let newTimeSlots: TimeSlot[];
      if (isSelected) {
        // Removendo período: remover apenas os horários deste período
        newTimeSlots = prev.timeSlots.filter(ts => !periodTimeSlots.includes(ts));
      } else {
        // Adicionando período: adicionar todos os horários deste período
        // Combinar horários existentes com os novos, removendo duplicatas
        newTimeSlots = [...new Set([...prev.timeSlots, ...periodTimeSlots])];
      }
      
      return {
        ...prev,
        periods: newPeriods,
        timeSlots: newTimeSlots
      };
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Função para selecionar uma alocação para edição
  const handleSelectAllocation = (alloc: Allocation) => {
    setSelectedAllocation(alloc);
    setShowSelector(false);
    // Atualizar formData com dados da alocação selecionada
    const project = alloc.projectId as Project;
    const fullProject = project && typeof project === 'object' 
      ? projects.find(p => (p._id || p.id) === (project._id || project.id))
      : null;
    
    setFormData({
      projectId: project?._id || project?.id || '',
      periods: [alloc.period],
      timeSlots: [alloc.timeSlot],
      status: alloc.status,
      artiaActivity: alloc.artiaActivity || '',
      notes: alloc.notes || ''
    });
    
    // Definir o gerente do projeto selecionado
    if (fullProject?.projectManager) {
      setSelectedManagerFilter(fullProject.projectManager);
    } else {
      setSelectedManagerFilter('');
    }
    
    // Carregar histórico e anexos
    if (alloc._id || alloc.id) {
      loadAllocationDetails(alloc._id || alloc.id);
    }
  };

  // Função para criar nova alocação (quando já há conflito)
  const handleCreateNew = () => {
    if (!effectiveIsAdmin) {
      console.warn('Tentativa de criar nova alocação por usuário não-admin bloqueada');
      return;
    }
    setSelectedAllocation(null);
    setShowSelector(false);
    setSelectedManagerFilter(''); // Limpar filtro de gerente
    setFormData({
      projectId: '',
      periods: [initialPeriod || 'manha' as Period],
      timeSlots: [initialTimeSlot || '08-10' as TimeSlot],
      status: 'a_confirmar',
      artiaActivity: '',
      notes: ''
    });
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content max-w-xl" onClick={e => e.stopPropagation()}>
        {/* Header - Fixo */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800">
            {showSelector 
              ? 'Alocações em Conflito' 
              : effectiveAllocation 
                ? (effectiveIsAdmin ? 'Editar Alocação' : 'Visualizar Alocação')
                : 'Nova Alocação'}
          </h2>
          <button 
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Tabs (apenas para edição) - Fixas */}
        {!showSelector && effectiveAllocation && (
          <div className="flex gap-1 border-b border-slate-200 flex-shrink-0 mt-4">
            <button
              onClick={() => setActiveTab('form')}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === 'form' 
                  ? 'border-ngr-secondary text-ngr-primary' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1" />
              Dados
            </button>
            <button
              onClick={() => setActiveTab('attachments')}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === 'attachments' 
                  ? 'border-ngr-secondary text-ngr-primary' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Paperclip className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1" />
              <span className="hidden sm:inline">Anexos</span> {attachments.length > 0 && `(${attachments.length})`}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === 'history' 
                  ? 'border-ngr-secondary text-ngr-primary' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1" />
              <span className="hidden sm:inline">Histórico</span>
            </button>
          </div>
        )}

        {/* Conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto pt-4 min-h-0">

        {/* Tela de seleção de conflitos */}
        {showSelector && hasConflict && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Este slot possui {existingAllocations.length} alocações em conflito</p>
                <p className="text-sm text-red-600 mt-1">Selecione uma alocação para editar ou crie uma nova.</p>
              </div>
            </div>

            <div className="space-y-2">
              {existingAllocations.map((alloc, index) => {
                const project = alloc.projectId as Project;
                const statusConfig = statusConfigs.find((s: StatusConfig) => s.key === alloc.status);
                const fullProject = project && typeof project === 'object' 
                  ? projects.find(p => (p._id || p.id) === (project._id || project.id))
                  : null;
                
                return (
                  <button
                    key={alloc._id || alloc.id || index}
                    onClick={() => handleSelectAllocation(alloc)}
                    className="w-full text-left p-4 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-ngr-secondary transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-800">
                          {project?.client || project?.projectId || 'Sem projeto'}
                        </p>
                        <p className="text-sm text-slate-500">
                          {project?.projectName || alloc.notes || '-'}
                        </p>
                        {fullProject?.projectManager && (
                          <p className="text-xs text-slate-400 mt-1">
                            Gerente: {fullProject.projectManager}
                          </p>
                        )}
                      </div>
                      <span 
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: statusConfig?.color || '#ccc',
                          color: statusConfig?.textColor || '#000'
                        }}
                      >
                        {statusConfig?.label || alloc.status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <button onClick={handleClose} className="btn-secondary flex-1">
                Fechar
              </button>
              {effectiveIsAdmin ? (
                <button onClick={handleCreateNew} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  Nova Alocação
                </button>
              ) : (
                <div className="flex-1 text-sm text-slate-500 italic text-center py-2">
                  Apenas administradores podem criar novas alocações
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Form */}
        {!showSelector && activeTab === 'form' && (
          <>
            {/* Aviso de conflito */}
            {willCreateConflict && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Atenção: Conflito detectado!</p>
                  <p className="text-sm text-red-600 mt-1">
                    Já existe {existingAllocations.length === 1 ? 'uma alocação' : `${existingAllocations.length} alocações`} para este consultor neste horário.
                  </p>
                </div>
              </div>
            )}

            {/* Info */}
            <div className="bg-ngr-light rounded-lg p-4 mb-4 space-y-2">
              <div className="flex items-center gap-2 text-slate-700">
                <UserIcon className="w-4 h-4 text-ngr-secondary" />
                <span className="font-medium">{consultant.name}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Calendar className="w-4 h-4" />
                <span>{format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
              </div>
              {/* Informação do projeto e gerente */}
              {effectiveAllocation && (() => {
                const project = effectiveAllocation.projectId as Project;
                if (project && typeof project === 'object') {
                  const fullProject = projects.find(p => (p._id || p.id) === (project._id || project.id));
                  return (
                    <>
                      <div className="flex items-center gap-2 text-slate-700 pt-2 border-t border-slate-200">
                        <Building2 className="w-4 h-4 text-ngr-secondary" />
                        <div className="flex-1">
                          <p className="font-medium">{fullProject?.client || project.client || project.projectId}</p>
                          <p className="text-xs text-slate-500">{fullProject?.projectName || project.projectName || '-'}</p>
                          {fullProject?.projectManager && (
                            <p className="text-xs text-slate-500 mt-1">
                              Gerente: <span className="font-medium">{fullProject.projectManager}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  );
                }
                return null;
              })()}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Period - Seleção Múltipla */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-2" />
                  Períodos *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['manha', 'tarde', 'noite'] as Period[]).map((p) => {
                    const isSelected = formData.periods.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => togglePeriod(p)}
                        disabled={!!effectiveAllocation || !effectiveIsAdmin} // Desabilita se estiver editando ou não for admin
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-all border flex items-center justify-center gap-2 ${
                          isSelected
                            ? 'bg-ngr-secondary text-white border-ngr-secondary' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        } ${(!!effectiveAllocation || !effectiveIsAdmin) ? 'cursor-not-allowed' : ''}`}
                      >
                        {isSelected && <Check className="w-4 h-4" />}
                        {PERIOD_LABELS[p]}
                      </button>
                    );
                  })}
                </div>
                {!effectiveAllocation && (
                  <p className="text-xs text-slate-500 mt-1">
                    Selecione um ou mais períodos
                  </p>
                )}
              </div>

              {/* Time Slots - Seleção Múltipla */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Horários *</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2">
                  {availableTimeSlots.map((slot) => {
                    const isSelected = formData.timeSlots.includes(slot);
                    return (
                      <label
                        key={slot}
                        className={`
                          flex items-center gap-2 p-2 rounded-lg border transition-colors
                          ${isSelected
                            ? 'bg-ngr-light border-ngr-secondary text-ngr-primary'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }
                          ${(!!effectiveAllocation || !effectiveIsAdmin) ? 'cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!!effectiveAllocation || !effectiveIsAdmin} // Desabilita se estiver editando ou não for admin
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({ ...prev, timeSlots: [...prev.timeSlots, slot] }));
                            } else {
                              setFormData(prev => ({ ...prev, timeSlots: prev.timeSlots.filter(t => t !== slot) }));
                            }
                          }}
                          className="sr-only"
                        />
                        <div className={`
                          w-4 h-4 rounded border flex items-center justify-center
                          ${isSelected
                            ? 'bg-ngr-secondary border-ngr-secondary'
                            : 'border-slate-300'
                          }
                        `}>
                          {isSelected && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span className="text-sm">{TIME_SLOT_LABELS[slot]}</span>
                      </label>
                    );
                  })}
                </div>
                {!effectiveAllocation && (
                  <p className="text-xs text-slate-500 mt-1">
                    Selecione um ou mais horários (serão criadas {(() => {
                      let total = 0;
                      for (const period of formData.periods) {
                        const periodTimeSlots = formData.timeSlots.filter(ts => 
                          TIME_SLOTS_BY_PERIOD[period].includes(ts)
                        );
                        total += periodTimeSlots.length;
                      }
                      return total;
                    })()} alocações)
                  </p>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                {willCreateConflict ? (
                  <div className="bg-red-100 border border-red-300 rounded-lg px-4 py-2 text-red-800 font-medium">
                    {statusLabelsFromConfig['conflito'] || 'CONFLITO'} (automático)
                  </div>
                ) : (
                  <select
                    value={formData.status}
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      const statusConfig = availableStatuses.find(s => s.key === newStatus);
                      const requiresProject = statusConfig?.requiresProject ?? true;
                      setFormData(prev => ({ 
                        ...prev, 
                        status: newStatus,
                        // Limpa o projeto se o novo status não requer projeto
                        projectId: requiresProject ? prev.projectId : ''
                      }));
                    }}
                    disabled={!effectiveIsAdmin}
                    className="select-field"
                  >
                    {availableStatuses.map(({ key, label }) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Project - Só mostra se o status requer projeto */}
              {currentStatusRequiresProject && (
                <>
                  {/* Filtro de Gerente */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      <UserIcon className="w-4 h-4 inline mr-2" />
                      Gerente do Projeto
                    </label>
                    <select
                      value={selectedManagerFilter}
                      onChange={(e) => {
                        const newManager = e.target.value;
                        setSelectedManagerFilter(newManager);
                        // Limpar projeto selecionado se não pertencer ao novo gerente
                        if (newManager && formData.projectId) {
                          const currentProject = projects.find(p => (p._id || p.id) === formData.projectId);
                          if (currentProject?.projectManager !== newManager) {
                            setFormData(prev => ({ ...prev, projectId: '' }));
                          }
                        }
                      }}
                      disabled={!effectiveIsAdmin}
                      className="select-field"
                    >
                      <option value="">Todos os gerentes</option>
                      {uniqueManagers.map((manager) => (
                        <option key={manager} value={manager}>
                          {manager}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Projeto */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      <Building2 className="w-4 h-4 inline mr-2" />
                      Projeto
                    </label>
                    <select
                      value={formData.projectId}
                      onChange={(e) => setFormData(prev => ({ ...prev, projectId: e.target.value }))}
                      className="select-field"
                      disabled={!!(selectedManagerFilter && filteredProjects.length === 0) || !effectiveIsAdmin}
                    >
                      <option value="">
                        {selectedManagerFilter && filteredProjects.length === 0
                          ? 'Nenhum projeto encontrado para este gerente'
                          : 'Selecione um projeto...'}
                      </option>
                      {filteredProjects.map((project) => (
                        <option key={project._id || project.id} value={project._id || project.id}>
                          {project.projectId} - {project.client} ({project.projectName})
                        </option>
                      ))}
                    </select>
                    {selectedManagerFilter && (
                      <p className="text-xs text-slate-500 mt-1">
                        Mostrando apenas projetos do gerente: <span className="font-medium">{selectedManagerFilter}</span>
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Atividade Artia */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Atividade Artia
                </label>
                <input
                  type="text"
                  value={formData.artiaActivity}
                  onChange={(e) => setFormData(prev => ({ ...prev, artiaActivity: e.target.value }))}
                  disabled={!effectiveIsAdmin}
                  className="input-field"
                  placeholder="link atividade no Artia..."
                />
                {/* Link clicável se for uma URL válida */}
                {formData.artiaActivity && (() => {
                  const url = formData.artiaActivity.trim();
                  const isValidUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('www.');
                  const displayUrl = url.startsWith('www.') ? `https://${url}` : url;
                  
                  if (isValidUrl) {
                    return (
                      <a
                        href={displayUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-sm text-ngr-primary hover:text-ngr-secondary transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span className="underline">Abrir link no Artia</span>
                      </a>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Observações</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  disabled={!effectiveIsAdmin}
                  className="input-field min-h-[60px] resize-none"
                  placeholder="Observações adicionais..."
                />
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex flex-wrap gap-2 justify-end">
                  <button type="button" onClick={handleClose} className="btn-secondary px-4 py-2 text-sm">
                    Fechar
                  </button>
                  {effectiveAllocation && effectiveIsAdmin && (
                    <button 
                      type="button" 
                      onClick={handleNew}
                      disabled={isSubmitting} 
                      className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Novo
                    </button>
                  )}
                  {effectiveIsAdmin && (
                    <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm">
                      {isSubmitting ? (
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-white" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Salvar
                    </button>
                  )}
                </div>
                {effectiveAllocation && effectiveIsAdmin && (
                  <div className="flex justify-start">
                    <button type="button" onClick={handleDelete} disabled={isSubmitting} className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1.5 px-2 py-1">
                      <Trash2 className="w-3.5 h-3.5" />
                      Remover alocação
                    </button>
                  </div>
                )}
              </div>
            </form>
          </>
        )}

        {/* Tab: Attachments */}
        {!showSelector && activeTab === 'attachments' && effectiveAllocation && (
          <div className="space-y-4">
            {/* Upload */}
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isUploading || !effectiveIsAdmin}
              />
              <label 
                htmlFor="file-upload" 
                className={`flex flex-col items-center gap-2 ${effectiveIsAdmin ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              >
                <Upload className="w-8 h-8 text-slate-400" />
                <span className="text-sm text-slate-600">
                  {isUploading ? 'Enviando...' : 'Clique para selecionar arquivo'}
                </span>
                <span className="text-xs text-slate-400">PDF, DOC, XLS, imagens (máx. 10MB)</span>
              </label>
            </div>

            {/* Lista de anexos */}
            <div className="space-y-2">
              {attachments.length === 0 ? (
                <p className="text-center text-slate-400 py-4">Nenhum anexo</p>
              ) : (
                attachments.map((attachment) => (
                  <div key={attachment._id} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <File className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">{attachment.originalName}</p>
                        <p className="text-xs text-slate-400">
                          {formatFileSize(attachment.size)} • {format(new Date(attachment.uploadedAt), "dd/MM/yyyy HH:mm")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/uploads/${attachment.filename}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-slate-400 hover:text-ngr-secondary"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      {effectiveIsAdmin && (
                        <button
                          onClick={() => handleRemoveAttachment(attachment._id!)}
                          className="p-2 text-slate-400 hover:text-red-500"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab: History */}
        {!showSelector && activeTab === 'history' && effectiveAllocation && (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-center text-slate-400 py-4">Nenhum histórico</p>
            ) : (
              history.slice().reverse().map((entry, idx) => {
                const user = entry.changedBy as User;
                return (
                  <div key={idx} className="flex gap-3 pb-3 border-b border-slate-100 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-ngr-light flex items-center justify-center flex-shrink-0">
                      <History className="w-4 h-4 text-ngr-secondary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-700">{entry.description}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {typeof user === 'object' ? user.name : 'Usuário'} • {format(new Date(entry.changedAt), "dd/MM/yyyy 'às' HH:mm")}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
        </div>{/* Fecha div de conteúdo com scroll */}
      </div>
    </div>
  );
}
